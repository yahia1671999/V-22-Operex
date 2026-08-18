import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileCheck, 
  Calendar, 
  FileText, 
  ClipboardList, 
  User, 
  Users, 
  TrendingUp, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Award, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Printer, 
  Edit3, 
  Trash2, 
  Star, 
  ChevronRight, 
  BookOpen, 
  Compass, 
  HelpCircle,
  FileSpreadsheet,
  Check,
  X,
  Target,
  Building2,
  Globe,
  AlertTriangle,
  RotateCcw,
  Send,
  Zap,
  Cpu,
  CheckSquare,
  Sparkles,
  Scale,
  ShieldCheck,
  BarChart3,
  Layers,
  ArrowRightLeft,
  Info,
  RefreshCw,
  Lock
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { 
  PerformanceCycle, 
  PerformanceCriteria, 
  PerformanceTemplate, 
  PerformanceEvaluation, 
  DevelopmentPlan,
  Employee,
  AuditTrailEntry
} from '../../types';
import { 
  calculateEmployeePerformance, 
  getPerformanceGrade, 
  DEFAULT_SYSTEM_CRITERIA,
  PerformanceAutoScoreResult 
} from '../../utils/performanceCalculator';

interface PerformanceAppraisalProps {
  isManagerPortal?: boolean;
}

export const PerformanceAppraisal: React.FC<PerformanceAppraisalProps> = ({ isManagerPortal = false }) => {
  const { language, t } = useLanguage();
  const { user, profile } = useAuth();
  const { can } = usePermissions();
  const isRtl = language === 'ar';
  
  const {
    employees,
    adminDepartments,
    performanceCycles,
    performanceTemplates,
    performanceCriteria,
    performanceEvaluations,
    performanceDevelopmentPlans,
    projectTasks,
    missions,
    attendanceRecords,
    leaveRequests,
    absenceRecords,
    investigations,
    penalties,
    refreshData,
    loading
  } = useData();

  // Find linked employee record for current user
  const currentEmployee = useMemo(() => {
    const emailToMatch = profile?.email || user?.email || '';
    return employees.find(e => {
      if (profile?.employeeId) return e.id === profile.employeeId;
      return e.email?.toLowerCase() === emailToMatch.toLowerCase();
    });
  }, [employees, profile, user]);

  const employeeId = currentEmployee?.id || '';

  // HR / Manager Check
  const hasHrAccess = useMemo(() => {
    const role = (profile as any)?.role || 'Viewer';
    return role === 'Admin' || role === 'Super Admin' || role === 'HR' || can('hr.performance.view') || can('hr.performance.manage') || role === 'Operations';
  }, [profile, can]);

  // Unified Sub-Tab selection based on permission mode
  const [activeTab, setActiveTab] = useState(() => {
    return isManagerPortal ? 'manager_dashboard' : 'my_dashboard';
  });

  // Confirmation Dialog State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    confirmLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  const triggerConfirm = (
    title: string, 
    description: string, 
    onConfirm: () => void, 
    confirmLabel?: string, 
    variant: 'danger' | 'warning' | 'info' = 'danger'
  ) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      onConfirm,
      confirmLabel,
      variant
    });
  };

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [cycleFilter, setCycleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');

  // Local filters for Reports & Statistics
  const [reportSearch, setReportSearch] = useState('');
  const [reportDept, setReportDept] = useState('ALL');
  const [reportStatus, setReportStatus] = useState('ALL');

  // Modals status states
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [editingCycleId, setEditingCycleId] = useState<string | null>(null);
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
  const [isDevPlanModalOpen, setIsDevPlanModalOpen] = useState(false);
  
  // Selected resource for viewing / rating
  const [selectedEvaluation, setSelectedEvaluation] = useState<PerformanceEvaluation | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<DevelopmentPlan | null>(null);

  // Form states - Cycles
  const [cycleSearchDept, setCycleSearchDept] = useState<string>('');
  const [cycleForm, setCycleForm] = useState<{
    nameAr: string;
    nameEn: string;
    year: string;
    cycleType: string;
    templateId: string;
    startDate: string;
    endDate: string;
    requireSelfEval: boolean;
    departmentScope: 'all' | 'specific';
    targetDepartments: string[];
  }>({
    nameAr: '',
    nameEn: '',
    year: new Date().getFullYear().toString(),
    cycleType: 'Annual',
    templateId: '',
    startDate: '',
    endDate: '',
    requireSelfEval: true,
    departmentScope: 'all',
    targetDepartments: []
  });

  // Helper to extract template targeting details
  const getTemplateDeptInfo = (tpl: PerformanceTemplate | undefined | null) => {
    if (!tpl) return { isSpecific: false, deptIds: [] as string[], deptNames: '', matchingDepts: [] as typeof adminDepartments };
    let depts: string[] = [];
    try {
      depts = Array.isArray(tpl.targetDepartments)
        ? tpl.targetDepartments
        : (typeof tpl.targetDepartments === 'string' ? JSON.parse(tpl.targetDepartments) : []);
    } catch {
      depts = [];
    }
    const isSpecific = Array.isArray(depts) && depts.length > 0 && !depts.includes('all');
    const matchingDepts = isSpecific ? adminDepartments.filter(d => depts.includes(d.id)) : [];
    const deptNames = matchingDepts.map(d => d.name).join('، ');
    return { isSpecific, deptIds: isSpecific ? depts : [], deptNames, matchingDepts };
  };

  // Selected template object in cycle modal
  const currentSelectedCycleTemplate = useMemo(() => {
    return performanceTemplates.find(t => t.id === cycleForm.templateId);
  }, [performanceTemplates, cycleForm.templateId]);

  const selectedTemplateDeptInfo = useMemo(() => {
    return getTemplateDeptInfo(currentSelectedCycleTemplate);
  }, [currentSelectedCycleTemplate, adminDepartments]);

  // Filter templates suitable for the cycle based on cycleType and selected department
  const eligibleCycleTemplates = useMemo(() => {
    return performanceTemplates.filter(tpl => {
      if (tpl.status === 'Inactive') return false;

      const { isSpecific, deptIds } = getTemplateDeptInfo(tpl);

      // If user has already chosen specific departments manually:
      if (cycleForm.departmentScope === 'specific' && cycleForm.targetDepartments.length > 0) {
        if (isSpecific) {
          // Cannot select template for a different department
          const matches = cycleForm.targetDepartments.some(dId => deptIds.includes(dId));
          if (!matches) return false;
        }
      }
      return true;
    });
  }, [performanceTemplates, cycleForm.departmentScope, cycleForm.targetDepartments, adminDepartments]);

  // Active employees targeted by the cycle configuration
  const activeCycleEmployees = useMemo(() => {
    const active = employees.filter(e => e.status === 'Active' && (e as any).exemptFromAppraisal !== 'Yes');
    if (cycleForm.departmentScope === 'all' || cycleForm.targetDepartments.length === 0 || cycleForm.targetDepartments.includes('all')) {
      return active;
    }
    return active.filter(e => e.departmentId && cycleForm.targetDepartments.includes(e.departmentId));
  }, [employees, cycleForm.departmentScope, cycleForm.targetDepartments]);

  // Form states - Criteria
  const [criteriaForm, setCriteriaForm] = useState({
    nameAr: '',
    nameEn: '',
    weight: 20,
    responseType: 'RatingStar',
    criterionKey: 'tasks',
    isEnabled: true,
    isAutoCalculated: true,
    descriptionAr: '',
    descriptionEn: ''
  });

  // Form states - Template
  const [editingTemplate, setEditingTemplate] = useState<PerformanceTemplate | null>(null);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all'); // 'all' | 'general' | deptId
  const [templateSearchDept, setTemplateSearchDept] = useState<string>('');
  const [templateForm, setTemplateForm] = useState<{
    nameAr: string;
    nameEn: string;
    description: string;
    jobTypes: string;
    departmentScope: 'all' | 'specific';
    targetDepartments: string[];
    successRate: number;
    requireSelfEval: boolean;
    sections: { nameAr: string; nameEn: string; weight: number; criteriaIds: string[] }[];
  }>({
    nameAr: '',
    nameEn: '',
    description: '',
    jobTypes: 'all',
    departmentScope: 'all',
    targetDepartments: ['all'],
    successRate: 60,
    requireSelfEval: true,
    sections: [
      { nameAr: 'معايير الأداء الرئيسية', nameEn: 'Core Performance Criteria', weight: 100, criteriaIds: [] }
    ]
  });

  // Form states - Evaluation (Rating Flow)
  const [evaluationRatings, setEvaluationRatings] = useState<Record<string, number>>({});
  const [evaluationFeedback, setEvaluationFeedback] = useState({
    strengths: '',
    improvements: '',
    recommendations: ''
  });

  // Higher Manager Decision Form States
  const [higherManagerDecisionChoice, setHigherManagerDecisionChoice] = useState<'AdoptSystem' | 'AdoptManager' | 'CustomScore'>('AdoptSystem');
  const [higherManagerCustomScore, setHigherManagerCustomScore] = useState<number>(85);
  const [higherManagerNotes, setHigherManagerNotes] = useState<string>('');
  const [showAutoScoreBreakdown, setShowAutoScoreBreakdown] = useState<boolean>(true);

  // Form states - Development Plan
  const [devPlanForm, setDevPlanForm] = useState({
    employeeId: '',
    evaluationId: '',
    weaknesses: [] as string[],
    trainingCourses: [] as { courseName: string; status: 'Planned' | 'In Progress' | 'Completed' }[],
    smartObjectives: [] as { objective: string; deadline: string; progress: number }[],
    progressPercentage: 0,
    status: 'Active' as 'Active' | 'Completed'
  });

  // Temporary item variables for form addition
  const [newWeakness, setNewWeakness] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [newObjectiveDeadline, setNewObjectiveDeadline] = useState('');

  // Status message displays
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Helper translations dict
  const txt = (ar: string, en: string) => (isRtl ? ar : en);

  // Common UI styling helper
  const cardBorderClass = 'border border-border bg-card text-card-foreground shadow-sm rounded-xl overflow-hidden transition-colors duration-150';

  // Reports & Statistics calculations and layout helpers
  const getGradeLevel = (score: number) => {
    if (score >= 95) return {
      ar: 'متميز بشكل استثنائي (Exceptional)',
      en: 'Exceptional',
      color: 'text-emerald-600 dark:text-emerald-400 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
    };
    if (score >= 88) return {
      ar: 'ممتاز جداً (Outstanding)',
      en: 'Outstanding',
      color: 'text-blue-600 dark:text-blue-400 border-blue-500 bg-blue-50 dark:bg-blue-950/30'
    };
    if (score >= 80) return {
      ar: 'يفوق التوقعات (Exceeds Expectations)',
      en: 'Exceeds Expectations',
      color: 'text-indigo-600 dark:text-indigo-400 border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
    };
    if (score >= 65) return {
      ar: 'يلبي التوقعات (Meets Expectations)',
      en: 'Meets Expectations',
      color: 'text-amber-600 dark:text-amber-400 border-amber-500 bg-amber-50 dark:bg-amber-950/30'
    };
    if (score >= 50) return {
      ar: 'بحاجة إلى تحسين (Needs Improvement)',
      en: 'Needs Improvement',
      color: 'text-orange-600 dark:text-orange-400 border-orange-500 bg-orange-50 dark:bg-orange-950/30'
    };
    return {
      ar: 'غير مرضٍ (Unsatisfactory)',
      en: 'Unsatisfactory',
      color: 'text-rose-600 dark:text-rose-400 border-rose-500 bg-rose-50 dark:bg-rose-950/30'
    };
  };

  const getAvgSelfScore = (ev: PerformanceEvaluation) => {
    if (!ev.selfScores || Object.keys(ev.selfScores).length === 0) return '---';
    const vals = Object.values(ev.selfScores).filter(v => typeof v === 'number' || !isNaN(Number(v))).map(v => Number(v));
    if (vals.length === 0) return '---';
    const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
    return `${Math.round(avg * 20)}%`;
  };

  const getAvgManagerScore = (ev: PerformanceEvaluation) => {
    if (!ev.managerScores || Object.keys(ev.managerScores).length === 0) return '---';
    const vals = Object.values(ev.managerScores).filter(v => typeof v === 'number' || !isNaN(Number(v))).map(v => Number(v));
    if (vals.length === 0) return '---';
    const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
    return `${Math.round(avg * 20)}%`;
  };

  // Real-time automatic performance score calculation for the selected evaluation instance
  const autoScoreResult = useMemo<PerformanceAutoScoreResult | null>(() => {
    if (!selectedEvaluation) return null;
    const targetEmp = employees.find(e => e.id === selectedEvaluation.employeeId);
    if (!targetEmp) return null;
    const cycle = performanceCycles.find(c => c.id === selectedEvaluation.cycleId);
    const template = performanceTemplates.find(t => t.id === selectedEvaluation.templateId);

    return calculateEmployeePerformance({
      employee: targetEmp,
      tasks: projectTasks || [],
      missions: missions || [],
      attendanceLogs: attendanceRecords || [],
      leaveRequests: leaveRequests || [],
      penalties: penalties || [],
      investigations: investigations || [],
      criteriaList: performanceCriteria || [],
      template: template || null,
      startDate: cycle?.startDate,
      endDate: cycle?.endDate
    });
  }, [
    selectedEvaluation,
    employees,
    performanceCycles,
    performanceTemplates,
    performanceCriteria,
    projectTasks,
    missions,
    attendanceRecords,
    leaveRequests,
    penalties,
    investigations
  ]);

  const openEvaluationModal = (ev: PerformanceEvaluation) => {
    setSelectedEvaluation(ev);
    const initialRatings = (ev.managerScores && Object.keys(ev.managerScores).length > 0)
      ? { ...ev.managerScores }
      : (ev.selfScores && Object.keys(ev.selfScores).length > 0)
        ? { ...ev.selfScores }
        : {};
    setEvaluationRatings(initialRatings);

    setEvaluationFeedback({
      strengths: ev.managerStrengths || ev.selfStrengths || '',
      improvements: ev.managerImprovements || ev.selfImprovements || '',
      recommendations: ev.managerRecommendations || ev.selfRecommendations || ''
    });

    setHigherManagerDecisionChoice((ev.higherManagerDecision as any) || 'AdoptSystem');
    setHigherManagerCustomScore(ev.higherManagerCustomScore || ev.finalPercentageScore || 85);
    setHigherManagerNotes(ev.higherManagerNotes || '');
    setIsEvaluationModalOpen(true);
  };

  const filteredReports = useMemo(() => {
    return performanceEvaluations.filter(ev => {
      const emp = employees.find(e => e.id === ev.employeeId);
      const matchesSearch = !reportSearch.trim() || 
        emp?.name?.toLowerCase().includes(reportSearch.toLowerCase()) ||
        emp?.employeeId?.toLowerCase().includes(reportSearch.toLowerCase());
      
      const matchesDept = reportDept === 'ALL' || emp?.departmentId === reportDept;
      
      let matchesStatus = true;
      if (reportStatus === 'COMPLETED') {
        matchesStatus = ev.status === 'Approved' || ev.status === 'Closed';
      } else if (reportStatus === 'PENDING') {
        matchesStatus = ev.status === 'PendingSelf' || ev.status === 'PendingManager' || ev.status === 'PendingReview';
      }
      
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [performanceEvaluations, employees, reportSearch, reportDept, reportStatus]);

  const statsFallback = useMemo(() => {
    const hasData = performanceEvaluations.length > 0;
    
    const totalRated = hasData ? new Set(performanceEvaluations.map(e => e.employeeId)).size : 5;
    const completed = hasData ? performanceEvaluations.filter(e => e.status === 'Approved' || e.status === 'Closed').length : 2;
    const pending = hasData ? performanceEvaluations.filter(e => e.status === 'PendingSelf' || e.status === 'PendingManager' || e.status === 'PendingReview').length : 3;
    
    let avg = 74;
    const approvedInFiltered = filteredReports.filter(ev => ev.status === 'Approved' || ev.status === 'Closed');
    if (hasData && approvedInFiltered.length > 0) {
      avg = Math.round(approvedInFiltered.reduce((sum, item) => sum + (item.finalPercentageScore || 0), 0) / approvedInFiltered.length);
    } else if (hasData) {
      const allApproved = performanceEvaluations.filter(e => e.status === 'Approved' || e.status === 'Closed');
      if (allApproved.length > 0) {
        avg = Math.round(allApproved.reduce((sum, item) => sum + (item.finalPercentageScore || 0), 0) / allApproved.length);
      }
    }
    
    return {
      totalRated,
      completed,
      pending,
      avg
    };
  }, [performanceEvaluations, filteredReports]);

  const classificationList = useMemo(() => {
    const approvedInFiltered = filteredReports.filter(ev => ev.status === 'Approved' || ev.status === 'Closed');
    const hasData = approvedInFiltered.length > 0;
    
    const countExceptional = hasData ? approvedInFiltered.filter(ev => (ev.finalPercentageScore || 0) >= 95).length : 0;
    const countOutstanding = hasData ? approvedInFiltered.filter(ev => (ev.finalPercentageScore || 0) >= 88 && (ev.finalPercentageScore || 0) <= 94).length : 2;
    const countExceeds = hasData ? approvedInFiltered.filter(ev => (ev.finalPercentageScore || 0) >= 80 && (ev.finalPercentageScore || 0) <= 87).length : 0;
    const countMeets = hasData ? approvedInFiltered.filter(ev => (ev.finalPercentageScore || 0) >= 65 && (ev.finalPercentageScore || 0) <= 79).length : 2;
    const countNeedsImprovement = hasData ? approvedInFiltered.filter(ev => (ev.finalPercentageScore || 0) >= 50 && (ev.finalPercentageScore || 0) <= 64).length : 1;
    const countUnsatisfactory = hasData ? approvedInFiltered.filter(ev => (ev.finalPercentageScore || 0) < 50).length : 0;

    const totalCalculated = countExceptional + countOutstanding + countExceeds + countMeets + countNeedsImprovement + countUnsatisfactory;
    const denom = totalCalculated > 0 ? totalCalculated : 1;

    return [
      {
        key: 'exceptional',
        nameAr: 'متميز بشكل استثنائي (Exceptional)',
        nameEn: 'Exceptional',
        range: '>= 95%',
        count: countExceptional,
        percentage: Math.round((countExceptional / denom) * 100),
        color: 'bg-emerald-600',
        textColor: 'text-emerald-500'
      },
      {
        key: 'outstanding',
        nameAr: 'ممتاز جداً (Outstanding)',
        nameEn: 'Outstanding',
        range: '88% - 94%',
        count: countOutstanding,
        percentage: Math.round((countOutstanding / denom) * 100),
        color: 'bg-blue-600',
        textColor: 'text-blue-500'
      },
      {
        key: 'exceeds',
        nameAr: 'يفوق التوقعات (Exceeds Expectations)',
        nameEn: 'Exceeds Expectations',
        range: '80% - 87%',
        count: countExceeds,
        percentage: Math.round((countExceeds / denom) * 100),
        color: 'bg-indigo-600',
        textColor: 'text-indigo-500'
      },
      {
        key: 'meets',
        nameAr: 'يلبي التوقعات (Meets Expectations)',
        nameEn: 'Meets Expectations',
        range: '65% - 79%',
        count: countMeets,
        percentage: Math.round((countMeets / denom) * 100),
        color: 'bg-yellow-500',
        textColor: 'text-amber-500'
      },
      {
        key: 'needsImprovement',
        nameAr: 'بحاجة إلى تحسين (Needs Improvement)',
        nameEn: 'Needs Improvement',
        range: '50% - 64%',
        count: countNeedsImprovement,
        percentage: Math.round((countNeedsImprovement / denom) * 100),
        color: 'bg-orange-500',
        textColor: 'text-orange-500'
      },
      {
        key: 'unsatisfactory',
        nameAr: 'غير مرضٍ (Unsatisfactory)',
        nameEn: 'Unsatisfactory',
        range: '< 50%',
        count: countUnsatisfactory,
        percentage: Math.round((countUnsatisfactory / denom) * 100),
        color: 'bg-rose-600',
        textColor: 'text-rose-500'
      }
    ];
  }, [filteredReports]);

  const handleExportExcel = () => {
    try {
      const dataToExport = filteredReports.map((ev, idx) => {
        const emp = employees.find(e => e.id === ev.employeeId);
        const dept = adminDepartments.find(d => d.id === emp?.departmentId);
        const cycle = performanceCycles.find(c => c.id === ev.cycleId);
        
        const selfAvg = getAvgSelfScore(ev);
        const managerAvg = getAvgManagerScore(ev);
        const finalScore = ev.status === 'Approved' ? `${ev.finalPercentageScore}%` : '---';
        const gradeLevel = ev.status === 'Approved' ? getGradeLevel(ev.finalPercentageScore).ar : '---';

        return {
          '#': idx + 1,
          [isRtl ? 'تفاصيل الموظف' : 'Employee Details']: emp?.name || '---',
          [isRtl ? 'الرقم الوظيفي' : 'Job Number']: emp?.employeeId || '---',
          [isRtl ? 'المسمى الوظيفي' : 'Job Title']: emp?.jobTitle || '---',
          [isRtl ? 'الإدارة' : 'Department']: dept ? dept.name : '---',
          [isRtl ? 'الدورة التقييمية' : 'Evaluation Cycle']: cycle ? (isRtl ? cycle.nameAr : cycle.nameEn) : '---',
          [isRtl ? 'التقييم الذاتي' : 'Self Assessment']: selfAvg,
          [isRtl ? 'تقييم المدير' : 'Manager Appraisal']: managerAvg,
          [isRtl ? 'الدرجة الموزونة' : 'Weighted Score']: finalScore,
          [isRtl ? 'مستوى التقييم النهائي المستحق' : 'Appraisal Grade Level']: gradeLevel
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, isRtl ? 'سجل التقييم التراكمي' : 'Cumulative Performance');
      XLSX.writeFile(workbook, `Performance_Cumulative_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(txt('تم تصدير ملف الاكسل بنجاح', 'Excel report file exported successfully'));
    } catch (err) {
      console.error(err);
      showToast(txt('فشل في تصدير ملف الاكسل', 'Failed to export Excel file'), 'error');
    }
  };

  const handlePrintReports = () => {
    window.print();
  };

  // BACKEND SAVE ACTIONS

  const handleSelectCycleTemplate = (newTemplateId: string) => {
    if (!newTemplateId) {
      setCycleForm(prev => ({ ...prev, templateId: '' }));
      return;
    }
    const tpl = performanceTemplates.find(t => t.id === newTemplateId);
    if (!tpl) {
      setCycleForm(prev => ({ ...prev, templateId: newTemplateId }));
      return;
    }
    const { isSpecific, deptIds } = getTemplateDeptInfo(tpl);
    if (isSpecific) {
      // If template is dedicated to specific department, automatically bind and target that department only
      setCycleForm(prev => ({
        ...prev,
        templateId: newTemplateId,
        departmentScope: 'specific',
        targetDepartments: deptIds,
        requireSelfEval: tpl.requireSelfEval !== false
      }));
    } else {
      // General template: allow manual configuration
      setCycleForm(prev => ({
        ...prev,
        templateId: newTemplateId,
        requireSelfEval: tpl.requireSelfEval !== false
      }));
    }
  };

  const handleOpenNewCycle = () => {
    setEditingCycleId(null);
    setCycleSearchDept('');
    const defaultTpl = performanceTemplates.find(t => t.status !== 'Inactive');
    const { isSpecific, deptIds } = getTemplateDeptInfo(defaultTpl);

    setCycleForm({
      nameAr: '',
      nameEn: '',
      year: new Date().getFullYear().toString(),
      cycleType: 'Annual',
      templateId: defaultTpl ? defaultTpl.id : '',
      startDate: '',
      endDate: '',
      requireSelfEval: defaultTpl ? defaultTpl.requireSelfEval !== false : true,
      departmentScope: isSpecific ? 'specific' : 'all',
      targetDepartments: isSpecific ? deptIds : []
    });
    setIsCycleModalOpen(true);
  };

  const handleCloseCycleModal = () => {
    setIsCycleModalOpen(false);
    setEditingCycleId(null);
    setCycleSearchDept('');
    setCycleForm({
      nameAr: '',
      nameEn: '',
      year: new Date().getFullYear().toString(),
      cycleType: 'Annual',
      templateId: '',
      startDate: '',
      endDate: '',
      requireSelfEval: true,
      departmentScope: 'all',
      targetDepartments: []
    });
  };

  const handleEditCycle = (cycle: any) => {
    setEditingCycleId(cycle.id);
    setCycleSearchDept('');
    let depts: string[] = [];
    try {
      depts = Array.isArray(cycle.targetDepartments) 
        ? cycle.targetDepartments 
        : (typeof cycle.targetDepartments === 'string' ? JSON.parse(cycle.targetDepartments) : []);
    } catch {
      depts = [];
    }
    const isSpecificScope = Array.isArray(depts) && depts.length > 0 && !depts.includes('all');
    setCycleForm({
      nameAr: cycle.nameAr || '',
      nameEn: cycle.nameEn || '',
      year: cycle.year || new Date().getFullYear().toString(),
      cycleType: cycle.cycleType || 'Annual',
      templateId: cycle.templateId || '',
      startDate: cycle.startDate || '',
      endDate: cycle.endDate || '',
      requireSelfEval: cycle.requireSelfEval !== false && cycle.requireSelfEval !== 0 && cycle.requireSelfEval !== '0',
      departmentScope: isSpecificScope ? 'specific' : 'all',
      targetDepartments: isSpecificScope ? depts : []
    });
    setIsCycleModalOpen(true);
  };

  const handleDeleteCycle = (cycleId: string) => {
    triggerConfirm(
      txt('تأكيد حذف دورة التقييم', 'Confirm Evaluation Cycle Deletion'),
      txt(
        'هل أنت متأكد من رغبتك في حذف دورة التقييم هذه نهائياً؟ ستتم إزالة الدورة وجميع سجلاتها الممررة.',
        'Are you sure you want to delete this evaluation cycle permanently? This will remove the cycle and all its associated logs.'
      ),
      async () => {
        setIsActionPending(true);
        try {
          const response = await fetch(`/api/performance-cycles/${cycleId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
          });
          if (!response.ok) throw new Error();
          showToast(txt('تم حذف دورة التقييم بنجاح', 'Evaluation cycle deleted successfully'));
          await refreshData();
        } catch {
          showToast(txt('فشل في حذف دورة التقييم', 'Failed to delete evaluation cycle'), 'error');
        } finally {
          setIsActionPending(false);
        }
      },
      txt('تأكيد الحذف', 'Confirm Delete'),
      'danger'
    );
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleForm.nameAr || !cycleForm.nameEn || !cycleForm.startDate || !cycleForm.endDate) {
      showToast(txt('يرجى ملء كافة الحقول الأساسية وتواريخ الدورة', 'Please fill in all required fields'), 'error');
      return;
    }
    if (!cycleForm.templateId) {
      showToast(txt('حقل «قالب التقييم» إلزامي لإنشاء الدورة. يرجى اختيار قالب التقييم.', 'The "Evaluation Template" field is mandatory. Please select a template.'), 'error');
      return;
    }

    const selectedTpl = performanceTemplates.find(t => t.id === cycleForm.templateId);
    const { isSpecific, deptIds } = getTemplateDeptInfo(selectedTpl);

    let finalTargetDepts: string[] = [];
    if (isSpecific) {
      // Must strictly target this department's employees
      finalTargetDepts = deptIds;
    } else {
      if (cycleForm.departmentScope === 'all') {
        finalTargetDepts = ['all'];
      } else {
        if (cycleForm.targetDepartments.length === 0) {
          showToast(txt('يرجى تحديد إدارة واحدة على الأقل أو اختيار "تعميم على كافة الإدارات"', 'Please select at least one department or choose All Departments'), 'error');
          return;
        }
        finalTargetDepts = cycleForm.targetDepartments.filter(id => id !== 'all');
      }
    }

    setIsActionPending(true);
    try {
      const url = editingCycleId ? `/api/performance-cycles/${editingCycleId}` : '/api/performance-cycles';
      const method = editingCycleId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({
          nameAr: cycleForm.nameAr,
          nameEn: cycleForm.nameEn,
          year: cycleForm.year,
          cycleType: cycleForm.cycleType,
          templateId: cycleForm.templateId,
          startDate: cycleForm.startDate,
          endDate: cycleForm.endDate,
          requireSelfEval: cycleForm.requireSelfEval !== false,
          targetDepartments: finalTargetDepts,
          // If creating, initialize as Draft
          ...(editingCycleId ? {} : { status: 'Draft' })
        })
      });
      if (!response.ok) throw new Error();
      showToast(editingCycleId 
        ? txt('تم تعديل دورة التقييم وحفظ القالب بنجاح', 'Evaluation cycle updated successfully')
        : txt('تم إنشاء دورة التقييم وربطها بالقالب المعتمد بنجاح', 'Performance cycle registered and linked to template successfully')
      );
      handleCloseCycleModal();
      await refreshData();
    } catch {
      showToast(editingCycleId
        ? txt('فشل في تعديل دورة التقييم', 'Failed to update evaluation cycle')
        : txt('فشل في حفظ دورة التقييم', 'Failed to register cycle'), 'error');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSyncWorkforceEvaluations = async () => {
    setIsActionPending(true);
    try {
      const response = await fetch('/api/performance-evaluations/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      showToast(
        txt(
          `تمت مزامنة ونشر التقييمات بنجاح! (تم إنشاء ${result.createdCount} نموذج جديد، وتحديث ${result.updatedCount} نموذج)`,
          `Sync completed successfully! (Created ${result.createdCount} new evaluations, updated ${result.updatedCount})`
        )
      );
      await refreshData();
    } catch {
      showToast(txt('فشل في مزامنة نماذج التقييم', 'Failed to synchronize evaluation forms'), 'error');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleUpdateCycleStatus = async (cycleId: string, nextStatus: 'Active' | 'Closed') => {
    setIsActionPending(true);
    try {
      const response = await fetch(`/api/performance-cycles/${cycleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!response.ok) throw new Error();

      // Auto-deploy evaluations via unified server sync endpoint when activating
      if (nextStatus === 'Active') {
        try {
          await fetch('/api/performance-evaluations/sync', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
          });
        } catch (syncErr) {
          console.error("Auto sync warning:", syncErr);
        }
      }

      showToast(txt('تم تحديث حالة دورة التقييم ومزامنة ملفات الموظفين', 'Cycle status updated and workforce profiles synchronized'));
      await refreshData();
    } catch {
      showToast(txt('فشل في تعديل حالة الدورة', 'Failed to modify cycle status'), 'error');
    } finally {
      setIsActionPending(false);
    }
  };

  const [editingCriteriaId, setEditingCriteriaId] = useState<string | null>(null);

  const handleCreateCriteria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!criteriaForm.nameAr || !criteriaForm.nameEn) {
      showToast(txt('الرجاء إدخال الاسم العربي والاسم الإنجليزي للمعيار', 'Please enter Arabic and English names'), 'error');
      return;
    }
    setIsActionPending(true);
    try {
      const url = editingCriteriaId ? `/api/performance-criteria/${editingCriteriaId}` : '/api/performance-criteria';
      const method = editingCriteriaId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({
          ...criteriaForm,
          weight: Number(criteriaForm.weight)
        })
      });
      if (!response.ok) throw new Error();

      showToast(editingCriteriaId 
        ? txt('تم تعديل المعيار بنجاح', 'Rating criterion updated successfully')
        : txt('تم إضافة مؤشر التقييم الجديد لشبكة المعايير', 'Rating criterion appended to database successfully')
      );

      setIsCriteriaModalOpen(false);
      setEditingCriteriaId(null);
      setCriteriaForm({ 
        nameAr: '', 
        nameEn: '', 
        weight: 20, 
        responseType: 'RatingStar', 
        criterionKey: 'custom',
        isEnabled: true,
        isAutoCalculated: false,
        descriptionAr: '', 
        descriptionEn: '' 
      });
      await refreshData();
    } catch {
      showToast(txt('فشل في حفظ المعيار', 'Failed to save criteria'), 'error');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDeleteCriteria = (criteriaId: string) => {
    triggerConfirm(
      txt('تأكيد حذف معيار التقييم', 'Confirm Criterion Deletion'),
      txt('هل أنت متأكد من رغبتك في حذف هذا المعيار نهائياً؟', 'Are you sure you want to delete this criterion?'),
      async () => {
        setIsActionPending(true);
        try {
          const response = await fetch(`/api/performance-criteria/${criteriaId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
          });
          if (!response.ok) throw new Error();
          showToast(txt('تم حذف المعيار بنجاح', 'Criterion deleted successfully'));
          await refreshData();
        } catch {
          showToast(txt('فشل في حذف المعيار', 'Failed to delete criteria'), 'error');
        } finally {
          setIsActionPending(false);
        }
      },
      txt('تأكيد الحذف', 'Confirm Delete'),
      'danger'
    );
  };

  const handleOpenNewTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateForm({
      nameAr: '',
      nameEn: '',
      description: '',
      jobTypes: 'all',
      departmentScope: 'all',
      targetDepartments: ['all'],
      successRate: 60,
      requireSelfEval: true,
      sections: [
        { nameAr: 'معايير الأداء الرئيسية', nameEn: 'Core Performance Criteria', weight: 100, criteriaIds: [] }
      ]
    });
    setTemplateSearchDept('');
    setIsTemplateModalOpen(true);
  };

  const handleOpenEditTemplateModal = (template: PerformanceTemplate) => {
    setEditingTemplate(template);
    const rawDepts = template.targetDepartments || ['all'];
    const isAll = rawDepts.length === 0 || rawDepts.includes('all');
    setTemplateForm({
      nameAr: template.nameAr || '',
      nameEn: template.nameEn || '',
      description: template.description || '',
      jobTypes: template.jobTypes || 'all',
      departmentScope: isAll ? 'all' : 'specific',
      targetDepartments: isAll ? ['all'] : rawDepts,
      successRate: template.successRate || 60,
      requireSelfEval: template.requireSelfEval ?? true,
      sections: template.sections && template.sections.length > 0 ? template.sections : [
        { nameAr: 'معايير الأداء الرئيسية', nameEn: 'Core Performance Criteria', weight: 100, criteriaIds: [] }
      ]
    });
    setTemplateSearchDept('');
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.nameAr || !templateForm.nameEn) {
      showToast(txt('يجب تسمية القالب بالعربية والإنجليزية لتجنب التكرار', 'Template requires names in both locales'), 'error');
      return;
    }

    let finalTargetDepts: string[] = [];
    if (templateForm.departmentScope === 'all') {
      finalTargetDepts = ['all'];
    } else {
      finalTargetDepts = templateForm.targetDepartments.filter(id => id !== 'all');
      if (finalTargetDepts.length === 0) {
        showToast(txt('يرجى تحديد إدارة واحدة على الأقل أو خيار "تعميم على جميع الإدارات"', 'Please select at least one department or choose "All Departments"'), 'error');
        return;
      }
    }

    setIsActionPending(true);
    try {
      const isEdit = !!editingTemplate;
      const url = isEdit ? `/api/performance-templates/${editingTemplate.id}` : '/api/performance-templates';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        nameAr: templateForm.nameAr,
        nameEn: templateForm.nameEn,
        description: templateForm.description,
        jobTypes: templateForm.jobTypes,
        targetDepartments: finalTargetDepts,
        successRate: templateForm.successRate,
        requireSelfEval: templateForm.requireSelfEval,
        sections: templateForm.sections,
        status: 'Active'
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error();

      showToast(
        isEdit
          ? txt('تم تحديث وحفظ قالب استمارة التقييم بنجاح', 'Evaluation template updated successfully')
          : txt('تم تصميم واعتماد قالب التقييم بنجاح', 'Dynamic performance template compiled and saved')
      );
      setIsTemplateModalOpen(false);
      setEditingTemplate(null);
      await refreshData();
    } catch {
      showToast(txt('فشل في حفظ واستمارة القالب', 'Failed to save template'), 'error');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    triggerConfirm(
      txt('تأكيد حذف قالب التقييم', 'Confirm Delete Template'),
      txt('هل أنت متأكد من رغبتك في حذف هذا القالب نهائياً من النظام؟', 'Are you sure you want to permanently delete this appraisal template?'),
      async () => {
        setIsActionPending(true);
        try {
          const response = await fetch(`/api/performance-templates/${templateId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
          });
          if (!response.ok) throw new Error();
          showToast(txt('تم حذف قالب التقييم بنجاح', 'Performance template deleted successfully'));
          await refreshData();
        } catch {
          showToast(txt('فشل في حذف القالب', 'Failed to delete template'), 'error');
        } finally {
          setIsActionPending(false);
        }
      },
      txt('تأكيد الحذف', 'Confirm Delete'),
      'danger'
    );
  };

  const [returnModalState, setReturnModalState] = useState<{ isOpen: boolean; evalId: string; reason: string }>({
    isOpen: false,
    evalId: '',
    reason: ''
  });

  const handleApplyAutoScores = () => {
    if (!autoScoreResult || !autoScoreResult.criteriaResults) return;
    const newRatings: Record<string, number> = { ...evaluationRatings };
    performanceCriteria.forEach(cri => {
      const matching = autoScoreResult.criteriaResults.find(b => 
        (cri.criterionKey && b.criterionKey === cri.criterionKey) ||
        b.criterionId === cri.id ||
        b.nameAr === cri.nameAr
      );
      if (matching && matching.isApplicable) {
        const stars = Math.max(1, Math.min(5, Math.round(matching.score / 20)));
        newRatings[cri.id] = stars;
      }
    });
    setEvaluationRatings(newRatings);
    showToast(txt('تم تطبيق درجات النظام التلقائية على استمارة التقييم بنجاح ⚡', 'Applied system calculated scores to criteria ratings ⚡'));
  };

  const handleHigherManagerDecision = async (
    evalObj: PerformanceEvaluation, 
    decisionType: 'AdoptSystem' | 'AdoptManager' | 'CustomScore' | 'Return', 
    returnReasonText?: string
  ) => {
    if (decisionType === 'Return' && (!returnReasonText || !returnReasonText.trim())) {
      showToast(txt('يرجى كتابة سبب وملاحظات إرجاع التقييم للمدير المباشر', 'Please provide a return reason comment'), 'error');
      return;
    }

    setIsActionPending(true);
    try {
      const userDisplayName = currentEmployee?.name || user?.email || 'الرئيس الأعلى';
      const existingAudit = Array.isArray(evalObj.auditTrail) ? evalObj.auditTrail : [];
      const newStatus = decisionType === 'Return' ? 'Returned for Re-evaluation' : 'Approved';

      let finalScore = evalObj.finalPercentageScore || 0;
      let finalGrade = evalObj.finalGrade || (isRtl ? getPerformanceGrade(finalScore).ar : getPerformanceGrade(finalScore).en);
      let decisionSource: 'System' | 'DirectManager' | 'CustomScore' | undefined = undefined;

      if (decisionType === 'AdoptSystem') {
        finalScore = autoScoreResult?.overallScore ?? (evalObj.systemCalculatedScore || evalObj.finalPercentageScore || 85);
        finalGrade = autoScoreResult ? (isRtl ? autoScoreResult.finalGrade.ar : autoScoreResult.finalGrade.en) : (isRtl ? getPerformanceGrade(finalScore).ar : getPerformanceGrade(finalScore).en);
        decisionSource = 'System';
      } else if (decisionType === 'AdoptManager') {
        const scores = Object.keys(evaluationRatings).length > 0 ? evaluationRatings : (evalObj.managerScores || {});
        const totalCriteriaCount = Object.keys(scores).length;
        if (totalCriteriaCount > 0) {
          const totalScore = Object.values(scores).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
          finalScore = Math.round((totalScore / (totalCriteriaCount * 5)) * 100);
        } else {
          finalScore = evalObj.finalPercentageScore || 80;
        }
        finalGrade = isRtl ? getPerformanceGrade(finalScore).ar : getPerformanceGrade(finalScore).en;
        decisionSource = 'DirectManager';
      } else if (decisionType === 'CustomScore') {
        finalScore = Math.max(0, Math.min(100, Number(higherManagerCustomScore) || 85));
        finalGrade = isRtl ? getPerformanceGrade(finalScore).ar : getPerformanceGrade(finalScore).en;
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
        previousStatus: evalObj.status,
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
        if (autoScoreResult) {
          payload.systemCalculatedScore = autoScoreResult.overallScore;
          payload.systemScoreBreakdown = autoScoreResult.criteriaResults;
        }
      }

      const response = await fetch(`/api/performance-evaluations/${evalObj.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error();

      showToast(decisionType === 'Return' 
        ? txt('تم إعادة التقييم للمدير المباشر مع تسجيل الملاحظات بنجاح', 'Evaluation returned for re-evaluation successfully')
        : txt('تم اعتماد قرار الرئيس الأعلى وتثبيت النتيجة النهائية بنجاح', 'Higher manager decision recorded and approved successfully')
      );

      setIsEvaluationModalOpen(false);
      setSelectedEvaluation(null);
      setReturnModalState({ isOpen: false, evalId: '', reason: '' });
      await refreshData();
    } catch (err: any) {
      showToast(txt('فشل في معالجة قرار الرئيس الأعلى', 'Failed to process higher manager decision'), 'error');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleSubmitEvaluationRating = async (e: React.FormEvent, targetSubmitStatus: 'PendingApproval' | 'Approved' | 'PendingManager' = 'PendingApproval') => {
    e.preventDefault();
    if (!selectedEvaluation) return;

    setIsActionPending(true);
    try {
      const isSelfFill = selectedEvaluation.employeeId === employeeId;
      const nextStatus = isSelfFill ? 'PendingManager' : targetSubmitStatus;
      const userDisplayName = currentEmployee?.name || user?.email || 'مستخدم النظام';
      
      const payload: Partial<PerformanceEvaluation> = {
        updatedAt: new Date().toISOString()
      };

      if (isSelfFill) {
        payload.selfScores = evaluationRatings;
        payload.selfStrengths = evaluationFeedback.strengths;
        payload.selfImprovements = evaluationFeedback.improvements;
        payload.selfRecommendations = evaluationFeedback.recommendations;
        payload.isSelfSubmitted = true;
        payload.status = 'PendingManager';
      } else {
        payload.managerScores = evaluationRatings;
        payload.managerStrengths = evaluationFeedback.strengths;
        payload.managerImprovements = evaluationFeedback.improvements;
        payload.managerRecommendations = evaluationFeedback.recommendations;
        payload.isManagerSubmitted = true;
        payload.status = nextStatus;

        if (autoScoreResult) {
          payload.systemCalculatedScore = autoScoreResult.overallScore;
          payload.systemScoreBreakdown = autoScoreResult.criteriaResults;
        }

        const totalCriteriaCount = Object.keys(evaluationRatings).length;
        if (totalCriteriaCount > 0) {
          const totalScore = Object.values(evaluationRatings).reduce((sum, val) => sum + val, 0);
          const maxPossible = totalCriteriaCount * 5;
          const finalPercent = Math.round((totalScore / maxPossible) * 100);
          payload.finalPercentageScore = finalPercent;
          payload.finalGrade = isRtl ? getPerformanceGrade(finalPercent).ar : getPerformanceGrade(finalPercent).en;
        }
      }

      const existingAudit = Array.isArray(selectedEvaluation.auditTrail) ? selectedEvaluation.auditTrail : [];
      const auditAction = isSelfFill 
        ? 'تقديم التقييم الذاتي' 
        : nextStatus === 'PendingApproval' 
          ? 'إرسال التقييم للرئيس الأعلى للاعتماد' 
          : 'اعتماد مباشر للتقييم';

      const newAuditEntry: AuditTrailEntry = {
        timestamp: new Date().toISOString(),
        userName: userDisplayName,
        action: auditAction,
        comment: evaluationFeedback.recommendations || 'تمت التعبئة والإرسال بنجاح',
        previousStatus: selectedEvaluation.status,
        newStatus: nextStatus
      };
      payload.auditTrail = [...existingAudit, newAuditEntry];

      const currentLogs = selectedEvaluation.workflowLog || [];
      payload.workflowLog = [
        ...currentLogs,
        {
          stage: isSelfFill ? 'Self Evaluation' : 'Manager Assessment',
          actor: userDisplayName,
          action: 'Submit',
          date: new Date().toISOString(),
          notes: evaluationFeedback.recommendations || 'Ratings dispatched successfully.'
        }
      ];

      const response = await fetch(`/api/performance-evaluations/${selectedEvaluation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error();

      showToast(txt('تم تسجيل وإرسال تقييم الأداء بنجاح', 'Performance evaluation saved successfully'));
      setIsEvaluationModalOpen(false);
      setSelectedEvaluation(null);
      setEvaluationRatings({});
      setEvaluationFeedback({ strengths: '', improvements: '', recommendations: '' });
      await refreshData();
    } catch {
      showToast(txt('فشل في إرسال التقييم', 'Failed to submit evaluation'), 'error');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleCreateDevPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devPlanForm.employeeId || !devPlanForm.evaluationId) {
      showToast(txt('يرجى ربط خطة التطوير بموظف وبدورة تقييم صحيحة', 'Development plan needs employee and appraisal cycle links'), 'error');
      return;
    }
    setIsActionPending(true);
    try {
      const response = await fetch('/api/performance-development-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify(devPlanForm)
      });
      if (!response.ok) throw new Error();
      showToast(txt('تم إنشاء نموذج خطة التطوير المهني للموظف', 'Professional Development plan authorized'));
      setIsDevPlanModalOpen(false);
      setDevPlanForm({
        employeeId: '',
        evaluationId: '',
        weaknesses: [],
        trainingCourses: [],
        smartObjectives: [],
        progressPercentage: 0,
        status: 'Active'
      });
      await refreshData();
    } catch {
      showToast(txt('فشل في حفظ خطة التطوير', 'Failed to create plan'), 'error');
    } finally {
      setIsActionPending(false);
    }
  };

  const handleUpdateDevPlanProgress = async (planId: string, itemIdx: number, type: 'course' | 'objective', nextVal: any) => {
    const plan = performanceDevelopmentPlans.find(p => p.id === planId);
    if (!plan) return;

    let updatedCourses = plan.trainingCourses ? [...plan.trainingCourses] : [];
    let updatedObjectives = plan.smartObjectives ? [...plan.smartObjectives] : [];

    if (type === 'course') {
      updatedCourses[itemIdx].status = nextVal;
    } else if (type === 'objective') {
      updatedObjectives[itemIdx].progress = Number(nextVal);
    }

    // Recalculate global percentage progress
    const totalItems = updatedCourses.length + updatedObjectives.length;
    let completedItems = 0;
    updatedCourses.forEach(c => { if (c.status === 'Completed') completedItems++; });
    updatedObjectives.forEach(o => completedItems += (o.progress / 100));

    const progressPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    try {
      const response = await fetch(`/api/performance-development-plans/${planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify({
          trainingCourses: updatedCourses,
          smartObjectives: updatedObjectives,
          progressPercentage,
          status: progressPercentage === 100 ? 'Completed' : 'Active'
        })
      });
      if (!response.ok) throw new Error();
      showToast(txt('تم مزامنة حالة التطوير الذاتي وإعادة احتساب النسبة', 'Self-development progression saved and recalculated'));
      await refreshData();
    } catch {
      showToast(txt('فشل في حفظ تقدم خطة التطوير', 'Failed to track progression'), 'error');
    }
  };

  // PRINTING / PDF EXPORT SIMULATOR
  const handlePrintDraft = (evalId: string) => {
    const frame = document.getElementById(`print-frame-${evalId}`);
    if (frame) {
      window.print();
    } else {
      showToast(txt('جاري تحضير ملف الطباعة وموازنة السطور الرسمية لكارت التقييم...', 'Compiling print-optimized PDF appraisal layout...'));
      setTimeout(() => {
        window.print();
      }, 500);
    }
  };

  // COMPUTED STATS AND GRIDS FILTERING
  const filteredEvaluations = useMemo(() => {
    return performanceEvaluations.filter(ev => {
      // Direct Search
      const emp = employees.find(e => e.id === ev.employeeId);
      const matchesSearch = emp ? emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || (emp.employeeId && emp.employeeId.includes(searchQuery)) : false;
      
      const matchesCycle = cycleFilter === 'ALL' || ev.cycleId === cycleFilter;
      const matchesStatus = statusFilter === 'ALL' || ev.status === statusFilter;
      const matchesDept = departmentFilter === 'ALL' || (emp?.departmentId === departmentFilter);

      // Row level isolation for standard employee in client service mode
      if (!isManagerPortal) {
        return ev.employeeId === employeeId && matchesCycle;
      }

      return matchesSearch && matchesCycle && matchesStatus && matchesDept;
    });
  }, [performanceEvaluations, employees, searchQuery, cycleFilter, statusFilter, departmentFilter, isManagerPortal, employeeId]);

  const activeStats = useMemo(() => {
    const relevant = performanceEvaluations;
    return {
      total: relevant.length,
      selfPending: relevant.filter(r => r.status === 'PendingSelf').length,
      managerPending: relevant.filter(r => r.status === 'PendingManager').length,
      approved: relevant.filter(r => r.status === 'Approved').length,
      avgScore: relevant.length > 0 ? Math.round(relevant.reduce((sum, item) => sum + (item.finalPercentageScore || 0), 0) / relevant.length) : 0
    };
  }, [performanceEvaluations]);

  return (
    <div className="p-1 sm:p-6 space-y-6 w-full max-w-none text-foreground bg-background transition-colors duration-300">
      
      {/* HEADER SECTION IN ACCORDANCE TO GOVERNANCE RULES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card text-card-foreground border border-border p-6 rounded-2xl shadow-sm">
        <div className="text-right">
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold font-mono">
            {txt('موديول تقييم الأداء والنمو الاستراتيجي', 'KPI Performance & Growth Module')}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black mt-2 select-all tracking-tight transition-all text-foreground">
            {isManagerPortal ? txt('لوحة تحكم تقييمات المنشأة', 'Performance Appraisal Console') : txt('ملفي التقييمي والنمو المهني', 'My Appraisals & Professional Growth')}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {isManagerPortal 
              ? txt('إدارات الدورات، تصميم معايير السلوك، مراجعة النماذج، واعتماد أوزان التقارير', 'Coordinate cycles, manage custom templates, grade employees, and authorize development files')
              : txt('الأولويات الذاتية، مخطط الأوزان السنوية، متابعة أهداف ومقررات خطة الأداء', 'Fill evaluations, track goals, and review training tracks allocated by your supervisor')}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(isManagerPortal || hasHrAccess) && (
            <button 
              onClick={handleSyncWorkforceEvaluations}
              disabled={isActionPending}
              className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold py-2.5 px-4 rounded-xl text-xs shadow-sm transition-all active:scale-95 duration-100 disabled:opacity-50"
              title={txt('مزامنة وتوليد نماذج التقييم تلقائياً للدورات النشطة', 'Auto-sync and generate evaluation forms for active cycles')}
            >
              <RefreshCw className={`w-4 h-4 ${isActionPending ? 'animate-spin' : ''}`} />
              {txt('مزامنة ونشر النماذج', 'Sync & Deploy Forms')}
            </button>
          )}

          <button 
            onClick={() => handlePrintDraft('all')}
            className="flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground border border-border font-bold py-2.5 px-4 rounded-xl text-xs shadow-sm transition-all active:scale-95 duration-100"
          >
            <Printer className="w-4 h-4" />
            {txt('تصدير كتقرير مصور', 'Export PDF/Print')}
          </button>
        </div>
      </div>

      {/* TOAST NOTIFICATION WINDOW */}
      {toastMessage && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border shadow-lg animate-bounce transition-all ${
          toastMessage.type === 'error' 
            ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 border-rose-200' 
            : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200'
        }`}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-xs sm:text-sm font-bold">{toastMessage.text}</p>
        </div>
      )}

      {/* CORE PERFORMANCE ANALYTICS WORKSPACE STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-card text-card-foreground border border-border rounded-2xl flex items-center justify-between shadow-sm">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground font-bold block mb-1">
              {isManagerPortal ? txt('إجمالي النماذج المفعلة', 'Total Workforce Cases') : txt('تقييماتي النشطة', 'My Active Assessments')}
            </span>
            <span className="text-3xl font-black block tracking-tight text-foreground">
              {isManagerPortal ? activeStats.total : performanceEvaluations.filter(e => e.employeeId === employeeId).length}
            </span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl">
            <ClipboardList className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="p-5 bg-card text-card-foreground border border-border rounded-2xl flex items-center justify-between shadow-sm">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground font-bold block mb-1">
              {txt('أوراق التقييم الذاتي المعلقة', 'Pending Self Evaluation')}
            </span>
            <span className="text-3xl font-black block tracking-tight text-amber-600 dark:text-amber-400">
              {isManagerPortal ? activeStats.selfPending : performanceEvaluations.filter(e => e.employeeId === employeeId && e.status === 'PendingSelf').length}
            </span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl">
            <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        <div className="p-5 bg-card text-card-foreground border border-border rounded-2xl flex items-center justify-between shadow-sm">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground font-bold block mb-1">
              {txt('بانتظار مراجعة وقرار المدير', 'Awaiting Manager Rating')}
            </span>
            <span className="text-3xl font-black block tracking-tight text-indigo-600 dark:text-indigo-400">
              {isManagerPortal ? activeStats.managerPending : performanceEvaluations.filter(e => e.employeeId === employeeId && e.status === 'PendingManager').length}
            </span>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl">
            <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        <div className="p-5 bg-card text-card-foreground border border-border rounded-2xl flex items-center justify-between shadow-sm">
          <div className="text-right">
            <span className="text-[10px] text-muted-foreground font-bold block mb-1">
              {txt('متوسط نسبة رضا وتقييمات الأداء', 'Average Performance Index')}
            </span>
            <span className="text-3xl font-black block tracking-tight text-emerald-600 dark:text-emerald-400">
              {isManagerPortal ? `${activeStats.avgScore}%` : (performanceEvaluations.filter(e => e.employeeId === employeeId && e.status === 'Approved')[0]?.finalPercentageScore ? `${performanceEvaluations.filter(e => e.employeeId === employeeId && e.status === 'Approved')[0]?.finalPercentageScore}%` : '---')}
            </span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
            <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      </div>

      {/* CORE TAB NAVIGATION CONTROLLER */}
      <div className="border-b border-border flex flex-wrap gap-2 pb-px max-w-full">
        {isManagerPortal ? (
          <>
            <button 
              onClick={() => setActiveTab('manager_dashboard')}
              className={`pb-3 pt-1 px-4 text-xs font-black relative transition-all flex items-center gap-2 ${activeTab === 'manager_dashboard' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Users className="w-4 h-4" />
              {txt('لوحة تحكم الفريق', 'Team Assessments Grid')}
            </button>
            <button 
              onClick={() => setActiveTab('evaluation_cycles')}
              className={`pb-3 pt-1 px-4 text-xs font-black relative transition-all flex items-center gap-2 ${activeTab === 'evaluation_cycles' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Calendar className="w-4 h-4" />
              {txt('دورات التقييم المعينة', 'Corporate Cycles')}
            </button>
            <button 
              onClick={() => setActiveTab('evaluation_templates')}
              className={`pb-3 pt-1 px-4 text-xs font-black relative transition-all flex items-center gap-2 ${activeTab === 'evaluation_templates' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <FileText className="w-4 h-4" />
              {txt('قوالب الاستمارات', 'Evaluation Templates')}
            </button>
            <button 
              onClick={() => setActiveTab('evaluation_criteria')}
              className={`pb-3 pt-1 px-4 text-xs font-black relative transition-all flex items-center gap-2 ${activeTab === 'evaluation_criteria' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <ClipboardList className="w-4 h-4" />
              {txt('معايير السلوك والإنتاجية', 'Performance Criteria')}
            </button>
            <button 
              onClick={() => setActiveTab('all_development_plans')}
              className={`pb-3 pt-1 px-4 text-xs font-black relative transition-all flex items-center gap-2 ${activeTab === 'all_development_plans' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Target className="w-4 h-4" />
              {txt('متابعة خطط التطوير', 'Talent Development Plans')}
            </button>
            <button 
              onClick={() => setActiveTab('reports_stats')}
              className={`pb-3 pt-1 px-4 text-xs font-black relative transition-all flex items-center gap-2 ${activeTab === 'reports_stats' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              {txt('التقارير والإحصائيات', 'Reports & Statistics')}
            </button>
          </>
        ) : (
          <>
            <button 
              onClick={() => setActiveTab('my_dashboard')}
              className={`pb-3 pt-1 px-4 text-xs font-black relative transition-all flex items-center gap-2 ${activeTab === 'my_dashboard' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <User className="w-4 h-4" />
              {txt('تقييماتي الشخصية', 'My Self Appraisals')}
            </button>
            <button 
              onClick={() => setActiveTab('my_development_plan')}
              className={`pb-3 pt-1 px-4 text-xs font-black relative transition-all flex items-center gap-2 ${activeTab === 'my_development_plan' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <TrendingUp className="w-4 h-4" />
              {txt('خطة النمو الفردية', 'My Development Goals')}
            </button>
          </>
        )}
      </div>

      {/* RENDER ACTIVE TAB VIEW */}

      {/* TAB A: MY DASHBOARD (Self-Service) */}
      {activeTab === 'my_dashboard' && (
        <div className="space-y-6">
          <div className="p-6 bg-muted/30 rounded-2xl border border-border text-right text-foreground">
            <h3 className="font-black text-lg text-foreground">
              {txt('أهلاً بك في مساحة التطوير المهني الذاتي 🍃', 'Welcome to your professional development environment 🍃')}
            </h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {txt('مجموع أوراق التقييم الحالية تظهر أدناه. تذكر دائماً تعبئة التقييم الذاتي بموضوعية وصدق ورفع التقدم المحرز في برامجك التدريبية لتحسين مخرجات السنة الحالية والتقييد بتوصيات المديرين المتراكمة.', 
                  'All active and completed appraisal cards are indexed below. Feel free to grade draft worksheets, note milestones, and sync planned training tracks to hit optimum scores.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={cardBorderClass}>
              <div className="bg-muted/50 p-4 border-b border-border flex justify-between items-center">
                <h4 className="font-black text-sm text-foreground">{txt('استبيانات التقييم الذاتي المتاحة الآن', 'My Open Self-Assessment Sheets')}</h4>
                <ClipboardList className="w-4 h-4 text-primary" />
              </div>
              <div className="p-4 space-y-4 bg-card text-card-foreground">
                {performanceEvaluations.filter(e => e.employeeId === employeeId && e.status === 'PendingSelf').length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground font-bold">
                    {txt('لا توجد أوراق مراجعة مفتوحة لك حالياً للتعديل', 'No open self-assessment schedules at this moment')}
                  </div>
                ) : (
                  performanceEvaluations.filter(e => e.employeeId === employeeId && e.status === 'PendingSelf').map(ev => {
                    const cycle = performanceCycles.find(c => c.id === ev.cycleId);
                    return (
                      <div key={ev.id} className="p-4 bg-muted/30 border border-border rounded-xl flex justify-between items-center text-foreground">
                        <div className="text-right">
                          <span className="font-black text-primary block text-xs">
                            {cycle ? (isRtl ? cycle.nameAr : cycle.nameEn) : txt('دورة مخصصة', 'Appraisal Period')}
                          </span>
                          <span className="text-[10px] text-muted-foreground block mt-1">
                            {txt('تاريخ الانتهاء: ', 'Deadline: ')} {cycle?.endDate || '---'}
                          </span>
                        </div>
                        <button 
                          onClick={() => openEvaluationModal(ev)}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-lg transition-all"
                        >
                          {txt('تعبئة التقييم الذاتي', 'Fill Appraise')}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className={cardBorderClass}>
              <div className="bg-muted/50 p-4 border-b border-border flex justify-between items-center">
                <h4 className="font-black text-sm text-foreground">{txt('أرشيف نتائج ومطابقة التقييم التاريخي', 'Approved Historical Appraisals')}</h4>
                <Award className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="p-4 space-y-4 bg-card text-card-foreground">
                {performanceEvaluations.filter(e => e.employeeId === employeeId && e.status === 'Approved').length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground font-bold">
                    {txt('سجل الأرشيف معتمد وفارغ حالياً', 'Archived appraisals folder complete')}
                  </div>
                ) : (
                  performanceEvaluations.filter(e => e.employeeId === employeeId && e.status === 'Approved').map(ev => {
                    const cycle = performanceCycles.find(c => c.id === ev.cycleId);
                    return (
                      <div key={ev.id} className="p-4 border border-border rounded-xl flex justify-between items-center bg-card text-card-foreground">
                        <div className="text-right">
                          <span className="font-black block text-sm text-foreground">
                            {cycle ? (isRtl ? cycle.nameAr : cycle.nameEn) : txt('تقييم أداء رسمي', 'Official Appraisal')}
                          </span>
                          <div className="flex gap-2 mt-1.5 items-center">
                            <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-250 dark:border-emerald-800/40">
                              {ev.finalGrade || txt('تقدير معتمد', 'Certified')}
                            </span>
                            <span className="text-muted-foreground text-[10px] font-mono">
                              {ev.finalPercentageScore}%
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={() => handlePrintDraft(ev.id)}
                          className="p-2 border border-border hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB B: MY DEVELOPMENT PLAN (Self-Service) */}
      {activeTab === 'my_development_plan' && (
        <div className="space-y-6">
          {performanceDevelopmentPlans.filter(p => p.employeeId === employeeId).length === 0 ? (
            <div className="p-12 text-center bg-card border border-border text-card-foreground rounded-2xl">
              <Compass className="w-12 h-12 text-muted-foreground/45 mx-auto block mb-3" />
              <h4 className="font-black text-sm text-foreground">{txt('لا توجد خطة تطوير مهنية نشطة حالياً', 'No active development plan allocated')}</h4>
              <p className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto p-1 leading-relaxed">
                {txt('تقوم الموارد البشرية والمديرين بالقسم بجدولة خطط التطوير تلقائياً في حالة تقابل مخرجات السنة مع مؤشرات نجاح حرجة لتطوير جودة وقدرات العمل.', 
                    'Talent growth files run systematically based on target gaps. Wait for HR templates allocation or cycle releases.')}
              </p>
            </div>
          ) : (
            performanceDevelopmentPlans.filter(p => p.employeeId === employeeId).map(plan => (
              <div key={plan.id} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* PLAN OVERVIEW */}
                <div className={`${cardBorderClass} p-5 space-y-4 lg:col-span-1`}>
                  <div className="text-right">
                    <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[10px] font-black">
                      {txt('سند التطوير والأهداف الذاتية', 'Talent Growth Docket')}
                    </span>
                    <h3 className="text-xl font-black mt-3 text-foreground">{txt('خطة النمو الفردية', 'Growth Tracker')}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{txt('مستوى المحتوى والمقررات المفروضة', 'Supervised courses and target achievements')}</p>
                  </div>

                  <div className="border-t border-border pt-4">
                    <span className="text-[10px] text-muted-foreground font-bold block mb-1.5">{txt('إجمالي نسبة الإنجاز والتقدم الخطي', 'Global Progression')}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-muted h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${plan.progressPercentage}%` }}
                        />
                      </div>
                      <span className="font-bold font-mono text-sm text-foreground">{plan.progressPercentage}%</span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 space-y-2">
                    <span className="text-[10px] text-muted-foreground font-bold block mb-1">{txt('نقاط الضعف الجاري تحسينها', 'Focus Gaps')}</span>
                    {plan.weaknesses && plan.weaknesses.map((w, idx) => (
                      <div key={idx} className="p-2.5 bg-rose-500/5 border border-rose-500/10 text-rose-700 dark:text-rose-400 rounded-lg text-xs font-bold">
                        {w}
                      </div>
                    ))}
                  </div>
                </div>

                {/* TRAINING TRACKS & SMART OBJECTIVES */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* COURSES */}
                  <div className={cardBorderClass}>
                    <div className="bg-muted/50 p-4 border-b border-border flex justify-between items-center">
                      <h4 className="font-black text-sm text-foreground">{txt('المسارات التدريبية المخصصة', 'Prescribed Training Tracks')}</h4>
                      <BookOpen className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="p-4 divide-y divide-border bg-card text-card-foreground">
                      {plan.trainingCourses && plan.trainingCourses.map((c, idx) => (
                        <div key={idx} className="py-3 flex justify-between items-center">
                          <span className="text-xs font-bold text-foreground">{c.courseName}</span>
                          <select 
                            value={c.status}
                            onChange={(e) => handleUpdateDevPlanProgress(plan.id, idx, 'course', e.target.value)}
                            className="bg-muted text-foreground border border-border rounded-lg text-xs p-1.5 text-right font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="Planned">{txt('مخطط لها', 'Planned')}</option>
                            <option value="In Progress">{txt('قيد الدراسة', 'In Progress')}</option>
                            <option value="Completed">{txt('مكتملة', 'Completed')}</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SMART OBJECTIVES */}
                  <div className={cardBorderClass}>
                    <div className="bg-muted/50 p-4 border-b border-border flex justify-between items-center">
                      <h4 className="font-black text-sm text-foreground">{txt('الأهداف النوعية ومؤشرات SMART', 'Specific SMART Objectives')}</h4>
                      <Target className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="p-4 space-y-4 bg-card text-card-foreground">
                      {plan.smartObjectives && plan.smartObjectives.map((obj, idx) => (
                        <div key={idx} className="p-3 border border-border bg-card text-card-foreground rounded-xl space-y-2">
                          <div className="flex justify-between items-start">
                            <h5 className="text-xs font-bold leading-relaxed max-w-md text-foreground">{obj.objective}</h5>
                            <span className="text-[10px] text-muted-foreground font-bold block">{txt('المهلة: ', 'Deadline: ')}{obj.deadline}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <input 
                              type="range"
                              min="0"
                              max="100"
                              value={obj.progress}
                              onChange={(e) => handleUpdateDevPlanProgress(plan.id, idx, 'objective', e.target.value)}
                              className="flex-1 cursor-pointer accent-indigo-600 h-1.5 bg-muted rounded-full"
                            />
                            <span className="text-xs font-bold font-mono text-muted-foreground">{obj.progress}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* ========================================================== */}
      {/* HR MANAGER / SUPERVISOR WORKSPACE VIEWS */}
      {/* ========================================================== */}

      {/* TAB 1: TEAM ASSESSMENTS GRID */}
      {activeTab === 'manager_dashboard' && (
        <div className="space-y-6">
          
          {/* CONTROL HEADER & HIGH DENSITY SEARCH / FILTERS */}
          <div className="bg-card text-card-foreground border border-border p-4 rounded-xl flex flex-wrap gap-3 items-center justify-between">
            <div className="flex-1 min-w-[200px] relative">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground select-none">
                <Search className="w-4 h-4" />
              </span>
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={txt('بحث باسم الموظف أو رقمه الوظيفي الفردي...', 'Search employee name, code, role...')}
                className="w-full pl-3 pr-9 py-2 rounded-xl text-xs bg-muted text-foreground border border-border text-right focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select 
                value={cycleFilter}
                onChange={(e) => setCycleFilter(e.target.value)}
                className="bg-muted text-foreground border border-border rounded-xl text-xs font-bold py-2 px-3 text-right focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">{txt('كل الدورات', 'All Cycles')}</option>
                {performanceCycles.map(c => (
                  <option key={c.id} value={c.id}>{isRtl ? c.nameAr : c.nameEn}</option>
                ))}
              </select>

              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-muted text-foreground border border-border rounded-xl text-xs font-bold py-2 px-3 text-right focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">{txt('كل الحالات', 'All Stages')}</option>
                <option value="PendingSelf">{txt('بانتظار الموظف', 'Awaiting Self')}</option>
                <option value="PendingManager">{txt('بانتظار التقييم الإداري', 'Awaiting Manager')}</option>
                <option value="Approved">{txt('معتمد نهائياً', 'Approved')}</option>
              </select>

              <select 
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="bg-muted text-foreground border border-border rounded-xl text-xs font-bold py-2 px-3 text-right focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">{txt('بكل الإدارات والأقسام', 'All Departments')}</option>
                {adminDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* HIGH DENSITY DIGITAL RECORD GRID */}
          <div className={cardBorderClass}>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs bg-card">
                <thead className="bg-muted border-b border-border text-muted-foreground">
                  <tr>
                    <th className="p-3 font-black">{txt('رقم ملف الموظف', 'Employee details')}</th>
                    <th className="p-3 font-black">{txt('القسم / الإدارة', 'Department')}</th>
                    <th className="p-3 font-black">{txt('دورة التقييم المنسوبة', 'Appraisal Period')}</th>
                    <th className="p-3 font-black">{txt('التقييم الذاتي', 'Self Appraise')}</th>
                    <th className="p-3 font-black">{txt('توصيات المدير', 'Grade/Percent')}</th>
                    <th className="p-3 font-black">{txt('الحالة الحالية', 'Governance Stage')}</th>
                    <th className="p-3 font-black text-center">{txt('خيارات العمليات', 'Operations')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-card text-card-foreground">
                  {filteredEvaluations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted-foreground font-bold bg-card">
                        {txt('لم يتم تطابق أي سجل تائه في هذه الموازين', 'No targeted employee evaluations matched your current filters')}
                      </td>
                    </tr>
                  ) : (
                    filteredEvaluations.map(ev => {
                      const emp = employees.find(e => e.id === ev.employeeId);
                      const cycle = performanceCycles.find(c => c.id === ev.cycleId);
                      const dept = adminDepartments.find(d => d.id === emp?.departmentId);

                      return (
                        <tr key={ev.id} className="hover:bg-muted/40 transition-all">
                          {/* EMP DETAILS */}
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center font-bold text-foreground">
                                {emp?.name ? emp.name[0] : 'E'}
                              </div>
                              <div>
                                <span className="font-black block text-foreground">{emp?.name || '---'}</span>
                                <span className="text-[10px] text-muted-foreground block mt-0.5">{emp?.jobTitle || txt('عضو برتبة غير محددة', 'Workforce member')}</span>
                              </div>
                            </div>
                          </td>

                          {/* DEPT */}
                          <td className="p-3 font-bold text-foreground/80">
                            {dept?.name || '---'}
                          </td>

                          {/* PERIOD */}
                          <td className="p-3">
                            <span className="font-mono text-foreground/80 font-bold block">{cycle ? (isRtl ? cycle.nameAr : cycle.nameEn) : '---'}</span>
                            <span className="text-[10px] text-muted-foreground block mt-0.5">Year {cycle?.year || '---'}</span>
                          </td>

                          {/* SELF GRADE */}
                          <td className="p-3 font-medium">
                            {ev.isSelfSubmitted ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                {txt('تم التعبئة', 'Submitted')}
                              </span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">{txt('قيد الانتظار', 'Pending')}</span>
                            )}
                          </td>

                          {/* SCORE AND GRADE */}
                          <td className="p-3">
                            {ev.status === 'Approved' ? (
                              <div>
                                <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono block text-sm">{ev.finalPercentageScore}%</span>
                                <span className="text-[10px] text-muted-foreground block mt-0.5">{ev.finalGrade || '---'}</span>
                                {ev.decisionSource && (
                                  <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                    {ev.decisionSource === 'System' ? '⚡ ' + txt('اعتماد النظام', 'System Adopted')
                                      : ev.decisionSource === 'DirectManager' ? txt('اعتماد المدير', 'Manager Adopted')
                                      : txt('قرار مخصص', 'Custom Score')}
                                  </span>
                                )}
                              </div>
                            ) : ev.systemCalculatedScore ? (
                              <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
                                <Zap className="w-3 h-3 text-amber-500" />
                                <span>{ev.systemCalculatedScore}% ({txt('تلقائي', 'Auto')})</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">---</span>
                            )}
                          </td>

                          {/* STAGE STATUS */}
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1 border ${
                              ev.status === 'PendingSelf' ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40'
                              : ev.status === 'PendingManager' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                              : ev.status === 'PendingApproval' ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/40'
                              : ev.status === 'Returned for Re-evaluation' || ev.status === 'Returned' ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40'
                              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                            }`}>
                              {ev.status === 'PendingSelf' ? txt('بانتظار الموظف', 'Awaiting Employee')
                                : ev.status === 'PendingManager' ? txt('بانتظار المدير المباشر', 'Under Manager Grade')
                                : ev.status === 'PendingApproval' ? txt('بانتظار اعتماد الرئيس الأعلى', 'Awaiting Higher Approval')
                                : ev.status === 'Returned for Re-evaluation' || ev.status === 'Returned' ? txt('مُعاد لإعادة التقييم', 'Returned for Re-evaluation')
                                : txt('معتمد نهائياً', 'Approved & Closed')}
                            </span>
                          </td>

                          {/* OPS */}
                          <td className="p-3">
                            <div className="flex justify-center gap-2">
                              {hasHrAccess && (
                                <button 
                                  onClick={() => openEvaluationModal(ev)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold font-mono py-1 px-3 rounded-lg text-[10px] transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>{ev.status === 'Approved' ? txt('عرض ومراجعة', 'View & Review') : txt('تقييم ومراجعة', 'Appraise')}</span>
                                </button>
                              )}
                              <button 
                                onClick={() => handlePrintDraft(ev.id)}
                                className="p-1 border border-border text-muted-foreground hover:text-foreground rounded-lg transition-all"
                                title="Print Appraisal"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: REPORTS AND STATISTICS */}
      {activeTab === 'reports_stats' && (
        <div className="space-y-6">
          <style>{`
            @media print {
              .no-print {
                display: none !important;
              }
              body, html, main, .main-content {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
              }
              aside, nav, header, footer, .sidebar {
                display: none !important;
              }
            }
          `}</style>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card text-card-foreground border border-border p-5 rounded-2xl shadow-sm no-print">
            <div className="text-right">
              <h2 className="text-xl font-black text-foreground">
                {txt('التقارير والإحصائيات', 'Reports & Statistics')}
              </h2>
              <p className="text-xs text-muted-foreground font-black mt-1.5 leading-relaxed">
                {txt('إصدار التقارير وعرض سجل التقييم التراكمي وتنزيل البيانات المعتمدة.', 'Issue appraisals reports, retrieve historical logs and fetch authenticated data.')}
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button 
                onClick={handleExportExcel}
                className="flex items-center gap-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold py-2 px-4 rounded-xl text-xs transition duration-155"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>{txt('تصدير Excel', 'Excel Export')}</span>
              </button>
              <button 
                onClick={handlePrintReports}
                className="flex items-center gap-2 bg-gradient-to-l from-slate-900 to-slate-800 hover:from-slate-850 hover:to-slate-750 dark:from-slate-100 dark:to-slate-200 dark:hover:from-slate-200 text-white dark:text-slate-950 font-bold py-2 px-4 rounded-xl text-xs shadow-md transition duration-155"
              >
                <Printer className="w-4 h-4" />
                <span>{txt('تصدير PDF', 'PDF Export / Print')}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 border border-border bg-card rounded-2xl shadow-xs flex items-center gap-4 select-none">
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">{txt('إجمالي الموظفين المقيمين', 'Total Assessed Employees')}</span>
                <p className="text-2xl font-black text-foreground">{statsFallback.totalRated}</p>
              </div>
            </div>

            <div className="p-5 border border-border bg-card rounded-2xl shadow-xs flex items-center gap-4 select-none">
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">{txt('التقييمات المكتملة', 'Completed Appraisals')}</span>
                <p className="text-2xl font-black text-foreground">{statsFallback.completed}</p>
              </div>
            </div>

            <div className="p-5 border border-border bg-card rounded-2xl shadow-xs flex items-center gap-4 select-none">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">{txt('التقييمات المعلقة', 'Pending Actions')}</span>
                <p className="text-2xl font-black text-foreground">{statsFallback.pending}</p>
              </div>
            </div>

            <div className="p-5 border border-border bg-card rounded-2xl shadow-xs flex items-center gap-4 select-none">
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">{txt('متوسط أداء المؤسسة', 'Avg Corporate Grade')}</span>
                <p className="text-2xl font-black text-foreground">{statsFallback.avg}%</p>
              </div>
            </div>
          </div>

          <div className="border border-border bg-card rounded-2xl p-6 space-y-4">
            <h3 className="font-black text-sm text-foreground text-right border-b border-border pb-3">
              {txt('تصنيف توزيع الدرجات النهائي', 'Final Grade Distribution Classification')}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classificationList.map(item => (
                <div key={item.key} className="p-4 border border-border bg-slate-50/50 dark:bg-slate-900/30 rounded-xl space-y-3.5 text-right">
                  <div className="flex justify-between items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wide border border-border bg-card text-muted-foreground">
                      {item.range}
                    </span>
                    <h4 className="font-extrabold text-xs text-foreground">
                      {isRtl ? item.nameAr : item.nameEn}
                    </h4>
                  </div>
                  <div className="flex justify-between items-end border-t border-dashed border-border/80 pt-2 text-xs">
                    <span className="text-muted-foreground font-black">
                      {isRtl ? `${item.percentage}% من الموظفين` : `${item.percentage}% of workspace`}
                    </span>
                    <div className="bg-primary/10 text-primary px-3 py-1 text-xs font-black rounded-lg">
                      {item.count}
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`${item.color} h-full transition-all duration-300`} 
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-border space-y-4 text-right no-print">
              <h3 className="font-black text-sm text-foreground">
                {txt('سجل التقييم التراكمي', 'Cumulative Workspace Appraisal Index')}
              </h3>

              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    placeholder={txt('بحث عن موظف، رقم وظيفي...', 'Filter by Employee, ID...')}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-border rounded-xl placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:right-auto rtl:left-3 top-3" />
                </div>
                <div className="w-full md:w-48">
                  <select
                    value={reportDept}
                    onChange={(e) => setReportDept(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-foreground"
                  >
                    <option value="ALL">{txt('جميع الإدارات (All)', 'All Departments')}</option>
                    {adminDepartments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full md:w-48">
                  <select
                    value={reportStatus}
                    onChange={(e) => setReportStatus(e.target.value)}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-foreground"
                  >
                    <option value="ALL">{txt('جميع حالات التقييم (All)', 'All Statuses')}</option>
                    <option value="COMPLETED">{txt('التقييمات المكتملة المعتمدة', 'Completed')}</option>
                    <option value="PENDING">{txt('تحت الإجراء والمعلقة', 'Pending Action')}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto text-right">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-border text-[10px] text-muted-foreground font-extrabold uppercase">
                    <th className="py-3 px-4 text-center">#</th>
                    <th className="py-3 px-4">{txt('تفاصيل الموظف', 'Employee Details')}</th>
                    <th className="py-3 px-4">{txt('الرقم الوظيفي', 'Employee ID')}</th>
                    <th className="py-3 px-4">{txt('الإدارة', 'Department')}</th>
                    <th className="py-3 px-4 text-center">{txt('التقييم الذاتي', 'Self Rating')}</th>
                    <th className="py-3 px-4 text-center">{txt('تقييم المدير', 'Manager Appraisal')}</th>
                    <th className="py-3 px-4 text-center">{txt('الدرجة الموزونة', 'Weighted Score')}</th>
                    <th className="py-3 px-4">{txt('مستوى التقييم النهائي المستحق', 'Final Level')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {filteredReports.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground font-bold">
                        {txt('لا توجد سجلات تراكمية مطابقة للبحث أو معتمدة حالياً', 'No authenticated entries match the active criteria.')}
                      </td>
                    </tr>
                  ) : (
                    filteredReports.map((ev, idx) => {
                      const emp = employees.find(e => e.id === ev.employeeId);
                      const dept = adminDepartments.find(d => d.id === emp?.departmentId);
                      const showGrade = ev.status === 'Approved' || ev.status === 'Closed';
                      const level = showGrade ? getGradeLevel(ev.finalPercentageScore) : null;
                      
                      return (
                        <tr key={ev.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition duration-100">
                          <td className="py-3.5 px-4 text-center font-bold font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-3.5 px-4 font-bold text-foreground">
                            <div>
                              <p className="text-sm">{emp?.name || '---'}</p>
                              <p className="text-[10px] text-muted-foreground font-black mt-0.5">{emp?.jobTitle || '---'}</p>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold select-all text-slate-500 text-left md:text-right">{emp?.employeeId || '---'}</td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-extrabold">{dept ? dept.name : '---'}</td>
                          <td className="py-3.5 px-4 text-center font-mono font-extrabold text-blue-600 dark:text-blue-400">{getAvgSelfScore(ev)}</td>
                          <td className="py-3.5 px-4 text-center font-mono font-extrabold text-indigo-600 dark:text-indigo-400">{getAvgManagerScore(ev)}</td>
                          <td className="py-3.5 px-4 text-center">
                            {showGrade ? (
                              <span className="font-mono bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-black px-2 py-1 rounded text-xs">
                                {ev.finalPercentageScore}%
                              </span>
                            ) : (
                              <span className="font-bold text-slate-400">{txt('تحت التقييم', 'Processing')}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {level ? (
                              <span className="inline-block text-[10px] font-black border border-border px-2 py-0.5 rounded-full select-none bg-slate-50 dark:bg-slate-900">
                                {isRtl ? level.ar : level.en}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 block max-w-xs leading-relaxed">
                                {txt('معلق بانتظار الاعتماد من اللجنة الإشرافية الموقرة', 'Pending panel approval')}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CORPORATE CYCLES LIST */}
      {activeTab === 'evaluation_cycles' && (
        <div className="space-y-6">
          {hasHrAccess && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card text-card-foreground border border-border p-4 rounded-xl shadow-sm">
              <div className="text-right">
                <h3 className="font-black text-sm text-foreground">
                  {txt('دورات التقييم المعتمدة', 'Corporate Evaluation Cycles')}
                </h3>
                <p className="text-muted-foreground text-[10px] font-bold mt-1">
                  {txt('إدارة الفروع الزمنية السنوية ونصف السنوية للتقييم وإطلاق الاستمارات', 'Manage annual and semi-annual appraisal timeline windows')}
                </p>
              </div>
              <button 
                onClick={handleOpenNewCycle}
                className="flex items-center gap-2 bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md transition-all active:scale-95 duration-100"
              >
                <Plus className="w-4 h-4" />
                {txt('دورة جديدة', 'New Cycle')}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {performanceCycles.map(cycle => {
              const linkedTpl = performanceTemplates.find(t => t.id === cycle.templateId);
              let cDepts: string[] = [];
              try {
                cDepts = Array.isArray(cycle.targetDepartments)
                  ? cycle.targetDepartments
                  : (typeof cycle.targetDepartments === 'string' ? JSON.parse(cycle.targetDepartments) : []);
              } catch {
                cDepts = [];
              }
              const isSpecificCycleDept = cDepts.length > 0 && !cDepts.includes('all');
              const cycleDeptNames = isSpecificCycleDept
                ? adminDepartments.filter(d => cDepts.includes(d.id)).map(d => d.name).join('، ')
                : txt('كافة الإدارات', 'All Departments');

              return (
                <div key={cycle.id} className={`${cardBorderClass} p-5 space-y-4 flex flex-col justify-between`}>
                  <div className="text-right">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-block ${
                        cycle.status === 'Active' ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                      }`}>
                        {cycle.status === 'Active' ? txt('نشط واستبيانات مفتوحة', 'Active Period') : txt('سجل مسودة غير مفعل بقاعدة البيانات', 'Draft')}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono font-bold">{cycle.year}</span>
                    </div>
                    <h3 className="text-base font-black mt-2.5 select-all text-foreground">
                      {isRtl ? cycle.nameAr : cycle.nameEn}
                    </h3>

                    {/* Linked Template Badge */}
                    <div className="mt-2.5 p-2 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-border/80 flex items-center gap-2 text-xs">
                      <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground font-bold">{txt('قالب التقييم المرتبط:', 'Linked Template:')}</p>
                        <p className="font-extrabold text-foreground truncate">
                          {linkedTpl ? (isRtl ? linkedTpl.nameAr : linkedTpl.nameEn) : txt('قالب عام موحد', 'General Template')}
                        </p>
                      </div>
                    </div>

                    {/* Department Scope Badge */}
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {isSpecificCycleDept ? (
                        <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                      <span className="font-bold text-[11px] truncate">
                        {isSpecificCycleDept ? `${txt('إدارة: ', 'Dept: ')}${cycleDeptNames}` : txt('نطاق عام (كافة الإدارات)', 'All Departments Scope')}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground space-y-1 mt-3 pt-2.5 border-t border-border/60">
                      <p className="flex justify-between"><span>{txt('تاريخ البداية: ', 'Starts: ')}</span><span className="font-mono">{cycle.startDate}</span></p>
                      <p className="flex justify-between"><span>{txt('تاريخ النهاية: ', 'Expires: ')}</span><span className="font-mono">{cycle.endDate}</span></p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="border-t border-border pt-3 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-bold">
                         {cycle.cycleType} Period
                      </span>
                      <div className="flex gap-2">
                        {cycle.status === 'Draft' && (
                          <button 
                            onClick={() => handleUpdateCycleStatus(cycle.id, 'Active')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold py-1 px-3 rounded-lg shadow-sm transition-all"
                          >
                            {txt('تنشيط فوري ونشر واستدعاء', 'Activate Cycle & Deploy')}
                          </button>
                        )}
                        {cycle.status === 'Active' && (
                          <button 
                            onClick={() => handleUpdateCycleStatus(cycle.id, 'Closed')}
                            className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-[10px] font-bold py-1 px-3 rounded-lg transition-all"
                          >
                            {txt('قفل البوابة', 'Close Window')}
                          </button>
                        )}
                      </div>
                    </div>

                    {hasHrAccess && (
                      <div className="flex items-center gap-2 border-t border-border/60 pt-2 text-xs font-black">
                        <button
                          onClick={() => handleEditCycle(cycle)}
                          className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 px-2 py-1 rounded-lg transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{txt('تعديل', 'Edit')}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteCycle(cycle.id)}
                          className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2 py-1 rounded-lg transition-colors mr-auto rtl:ml-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{txt('حذف', 'Delete')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: APPRAISAL TEMPLATES */}
      {activeTab === 'evaluation_templates' && (
        <div className="space-y-6">
          {hasHrAccess && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card text-card-foreground border border-border p-4 rounded-xl shadow-sm">
              <div className="text-right">
                <h3 className="font-black text-sm text-foreground">
                  {txt('قوالب الاستمارات وأقسام الوزن النسبي', 'Evaluation Templates & Section Weighting')}
                </h3>
                <p className="text-muted-foreground text-[10px] font-bold mt-1">
                  {txt('تصميم وتخصيص قوالب التقييم لإدارات محددة أو تعميمها على كافة القطاعات في المنشأة', 'Design templates tailored for specific departments or generalized enterprise-wide')}
                </p>
              </div>
              <button 
                onClick={handleOpenNewTemplateModal}
                className="flex items-center gap-2 bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md transition-all active:scale-95 duration-100 shrink-0"
              >
                <Plus className="w-4 h-4" />
                {txt('قالب تقييم جديد', 'New Evaluation Template')}
              </button>
            </div>
          )}

          {/* Department Scope Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border/80">
            <div className="flex items-center gap-2 text-xs font-black text-foreground">
              <SlidersHorizontal className="w-4 h-4 text-blue-600" />
              <span>{txt('تصفية القوالب حسب الإدارة المستهدفة:', 'Filter templates by target department:')}</span>
            </div>
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="text-xs p-2 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-blue-500 min-w-[200px]"
            >
              <option value="all">{txt('جميع القوالب (الكل)', 'All Templates')}</option>
              <option value="general">{txt('النماذج العامة (تعميم على الجميع)', 'General Enterprise Templates')}</option>
              {adminDepartments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {txt(`مخصص لإدارة: ${dept.name}`, `Dept: ${dept.name}`)}
                </option>
              ))}
            </select>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {performanceTemplates
              .filter(template => {
                if (selectedDeptFilter === 'all') return true;
                const depts = template.targetDepartments || ['all'];
                if (selectedDeptFilter === 'general') {
                  return depts.length === 0 || depts.includes('all');
                }
                return depts.includes(selectedDeptFilter);
              })
              .map(template => {
                const targetDepts = template.targetDepartments || ['all'];
                const isGeneral = targetDepts.length === 0 || targetDepts.includes('all');

                return (
                  <div key={template.id} className={cardBorderClass}>
                    <div className="bg-muted/50 p-4 border-b border-border flex justify-between items-center text-card-foreground">
                      <div>
                        <h4 className="font-black text-sm text-foreground">
                          {isRtl ? template.nameAr : template.nameEn}
                        </h4>
                        {template.description && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{template.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isGeneral ? (
                          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-emerald-500/20 shrink-0">
                            <Globe className="w-3 h-3" />
                            {txt('تعميم على الكل', 'General (All)')}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-indigo-500/20 shrink-0">
                            <Building2 className="w-3 h-3" />
                            {txt(`مخصص لـ (${targetDepts.length}) إدارات`, `Targeted (${targetDepts.length})`)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 space-y-4 bg-card">
                      {/* Targeted Department Badges */}
                      {!isGeneral && targetDepts.length > 0 && (
                        <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                          <span className="text-[10px] font-black text-indigo-900 dark:text-indigo-300 block mb-1">
                            {txt('الإدارات المشمولة بهذا النموذج:', 'Covered Departments:')}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {targetDepts.map(dId => {
                              const deptObj = adminDepartments.find(d => d.id === dId);
                              return (
                                <span key={dId} className="text-[9px] font-bold bg-background text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 shadow-xs">
                                  <Building2 className="w-2.5 h-2.5 text-indigo-500" />
                                  {deptObj?.name || dId}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Criteria Sections */}
                      {template.sections && template.sections.map((sect, sIdx) => (
                        <div key={sIdx} className="p-3 bg-muted rounded-xl space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-black text-foreground">
                              {isRtl ? sect.nameAr : sect.nameEn}
                            </span>
                            <span className="text-muted-foreground font-bold font-mono">
                              {txt(`الوزن: ${sect.weight}%`, `Weight: ${sect.weight}%`)}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {sect.criteriaIds && sect.criteriaIds.map(cId => {
                              const criterion = performanceCriteria.find(c => c.id === cId);
                              return (
                                <span key={cId} className="bg-foreground/5 dark:bg-slate-800 px-2.5 py-1 text-[9px] rounded-lg text-muted-foreground font-bold">
                                  {criterion ? (isRtl ? criterion.nameAr : criterion.nameEn) : '---'}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Actions Footer */}
                      {hasHrAccess && (
                        <div className="flex items-center gap-2 border-t border-border/60 pt-3 text-xs font-black">
                          <button
                            onClick={() => handleOpenEditTemplateModal(template)}
                            className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{txt('تعديل القالب', 'Edit Template')}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-2.5 py-1 rounded-lg transition-colors mr-auto rtl:ml-auto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{txt('حذف', 'Delete')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 4: EVALUATION CRITERIA */}
      {activeTab === 'evaluation_criteria' && (
        <div className="space-y-6">
          {hasHrAccess && (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card text-card-foreground border border-border p-4 rounded-xl shadow-sm">
              <div className="text-right">
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600" />
                  <span>{txt('معايير السلوك والإنتاجية والمؤشرات المشتركة', 'Performance & Behavior Criteria Catalog')}</span>
                </h3>
                <p className="text-muted-foreground text-[10px] font-bold mt-1">
                  {txt('تحديد المعايير المعتمدة، تفعيلها، ضبط أوزانها النسبية، وربطها بنظام الاحتساب الآلي الذكي.', 'Manage criteria definitions, dynamic weights, and automated operational data calculation.')}
                </p>
              </div>
              <button 
                onClick={() => {
                  setEditingCriteriaId(null);
                  setCriteriaForm({ 
                    nameAr: '', 
                    nameEn: '', 
                    weight: 20, 
                    responseType: 'RatingStar', 
                    criterionKey: 'tasks',
                    isEnabled: true,
                    isAutoCalculated: true,
                    descriptionAr: '', 
                    descriptionEn: '' 
                  });
                  setIsCriteriaModalOpen(true);
                }}
                className="flex items-center gap-2 bg-gradient-to-l from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2 px-4 rounded-xl text-xs shadow-md transition-all active:scale-95 duration-100 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {txt('إضافة معيار جديد', 'Add Criteria')}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {performanceCriteria.map(criteria => (
              <div key={criteria.id} className={`${cardBorderClass} p-5 space-y-3 relative`}>
                <div className="flex justify-between items-start">
                  <div className="text-right">
                    <h4 className="font-black text-sm text-foreground block">
                      {isRtl ? criteria.nameAr : criteria.nameEn}
                    </h4>
                    <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                      <span className="font-mono bg-blue-50 dark:bg-blue-950 text-blue-600 px-2 py-0.5 rounded-full font-black text-[10px] border border-blue-200 dark:border-blue-800">
                        {txt('الوزن: ', 'Weight: ')}{criteria.weight}%
                      </span>
                      {criteria.isAutoCalculated && (
                        <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-black text-[9px] border border-amber-200 dark:border-amber-800/40 flex items-center gap-1">
                          <Zap className="w-2.5 h-2.5" />
                          <span>{txt('احتساب آلي', 'Auto')}</span>
                        </span>
                      )}
                      {criteria.isEnabled === false ? (
                        <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full font-bold text-[9px]">
                          {txt('معطل', 'Disabled')}
                        </span>
                      ) : (
                        <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold text-[9px] border border-emerald-200 dark:border-emerald-800/40">
                          {txt('مفعل', 'Active')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed font-bold">
                  {isRtl ? criteria.descriptionAr : criteria.descriptionEn || txt('لا يوجد توصيف مدرج حالياً', 'No description offered')}
                </p>
                <div className="border-t border-border pt-3 text-[10px] text-muted-foreground flex justify-between items-center">
                  <span>{txt('نوع التقييم: ', 'Response: ')} {criteria.responseType}</span>
                  {hasHrAccess && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingCriteriaId(criteria.id);
                          setCriteriaForm({
                            nameAr: criteria.nameAr,
                            nameEn: criteria.nameEn,
                            weight: criteria.weight,
                            responseType: criteria.responseType,
                            criterionKey: criteria.criterionKey || 'tasks',
                            isEnabled: criteria.isEnabled !== false,
                            isAutoCalculated: criteria.isAutoCalculated !== false,
                            descriptionAr: criteria.descriptionAr || '',
                            descriptionEn: criteria.descriptionEn || ''
                          });
                          setIsCriteriaModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 font-extrabold cursor-pointer"
                      >
                        {txt('تعديل', 'Edit')}
                      </button>
                      <button 
                        onClick={() => handleDeleteCriteria(criteria.id)}
                        className="text-red-500 hover:text-red-600 font-extrabold cursor-pointer"
                      >
                        {txt('حذف', 'Delete')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: ALL TALENT DEVELOPMENT PLANS CONTROL MODULE */}
      {activeTab === 'all_development_plans' && (
        <div className="space-y-6">
          <div className={cardBorderClass}>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs bg-card">
                <thead className="bg-muted border-b border-border text-muted-foreground">
                  <tr>
                    <th className="p-3 font-black">{txt('الموظف المعني', 'Employee Name')}</th>
                    <th className="p-3 font-black">{txt('أوجه الثغرات ونقاط الضعف رصد القالب', 'Coded Focus Gaps')}</th>
                    <th className="p-3 font-black">{txt('المقررات المعينة بالخطة', 'Training Courses')}</th>
                    <th className="p-3 font-black">{txt('مخطط أهداف SMART', 'Objectives Count')}</th>
                    <th className="p-3 font-black text-center">{txt('معدل التقدم بمحور الإنجاز', 'Plan progression')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 bg-card text-card-foreground">
                  {performanceDevelopmentPlans.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-muted-foreground font-bold bg-card">
                        {txt('لا توجد خطة تطوير مفعلة للموظفين حالياً', 'No development plans defined yet')}
                      </td>
                    </tr>
                  ) : (
                    performanceDevelopmentPlans.map(plan => {
                      const emp = employees.find(e => e.id === plan.employeeId);
                      return (
                        <tr key={plan.id} className="hover:bg-muted/40 transition-all bg-card">
                          <td className="p-3 font-black select-all text-foreground bg-card">{emp?.name || '---'}</td>
                          <td className="p-3 max-w-[200px] text-muted-foreground font-bold bg-card">
                            {plan.weaknesses && plan.weaknesses.join(' • ')}
                          </td>
                          <td className="p-3 text-muted-foreground bg-card">
                            {plan.trainingCourses && plan.trainingCourses.map(c => c.courseName).join(', ')}
                          </td>
                          <td className="p-3 font-mono font-bold text-foreground/80 bg-card">
                            {plan.smartObjectives?.length || 0} SMART Goals
                          </td>
                          <td className="p-3 bg-card">
                            <div className="flex items-center gap-2.5 justify-end">
                              <span className="font-mono font-black text-foreground">{plan.progressPercentage}%</span>
                              <div className="w-20 bg-muted h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-indigo-600 h-full rounded-full"
                                  style={{ width: `${plan.progressPercentage}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* DIALOGS AND CONFIGURATION MODALS */}
      {/* ========================================================== */}

      {/* DIALOG 1: ADD NEW EVALUATION CYCLE */}
      {isCycleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl p-6 w-full max-w-xl shadow-xl text-right animate-in fade-in zoom-in-95 duration-155 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <button onClick={handleCloseCycleModal} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
              <h2 className="text-lg font-black flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                {editingCycleId 
                  ? txt('تعديل دورة تقييم أداء معينة', 'Edit Evaluation Cycle') 
                  : txt('إنشاء دورة تقييم أداء جديدة', 'Create Evaluation Cycle')
                }
              </h2>
            </div>

            <form onSubmit={handleCreateCycle} className="space-y-4">
              {/* Mandatory Template Selection */}
              <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-blue-200 dark:border-blue-900/50">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>{txt('قالب التقييم المعتمد للدورة', 'Evaluation Template')}</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </label>
                  <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">
                    {txt('حقل إلزامي', 'Mandatory Field')}
                  </span>
                </div>

                <select 
                  required
                  value={cycleForm.templateId}
                  onChange={(e) => handleSelectCycleTemplate(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  <option value="">-- {txt('اختر قالب التقييم (إلزامي) *', 'Select Evaluation Template (Required) *')} --</option>
                  {eligibleCycleTemplates.map(tpl => {
                    const info = getTemplateDeptInfo(tpl);
                    const label = info.isSpecific 
                      ? `🏢 ${tpl.nameAr} - [${txt('مخصص لإدارة: ', 'Dept: ')}${info.deptNames}]`
                      : `🌐 ${tpl.nameAr} - [${txt('قالب عام لكافة الإدارات', 'General - All Depts')}]`;
                    return (
                      <option key={tpl.id} value={tpl.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                {/* Dynamic Notification and Targeting Feedback */}
                {selectedTemplateDeptInfo.isSpecific ? (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs space-y-1.5 animate-in fade-in">
                    <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-black">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>{txt('قالب مخصص لإدارة معينة (مقيد)', 'Department-Specific Template (Locked)')}</span>
                    </div>
                    <p className="text-[11px] text-indigo-900/80 dark:text-indigo-200 leading-relaxed font-bold">
                      {txt(
                        `تم ضبط نطاق الدورة تلقائياً لجميع الموظفين النشطين في إدارة «${selectedTemplateDeptInfo.deptNames}» (${activeCycleEmployees.length} موظف نشط). لا يُسمح باختيار قالب مخصص لإدارة مختلفة.`,
                        `Cycle scope is automatically locked to all active employees in "${selectedTemplateDeptInfo.deptNames}" (${activeCycleEmployees.length} active employees). Selecting templates for other departments is restricted.`
                      )}
                    </p>
                  </div>
                ) : cycleForm.templateId ? (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs space-y-1 animate-in fade-in">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-black">
                      <Globe className="w-4 h-4 shrink-0" />
                      <span>{txt('قالب تقييم عام', 'General Performance Template')}</span>
                    </div>
                    <p className="text-[11px] text-emerald-900/80 dark:text-emerald-200 font-bold">
                      {txt(
                        'هذا القالب عام؛ يمكنك تعميم الدورة على كافة الإدارات أو تحديد إدارات وموظفين مستهدفين يدوياً.',
                        'This is a general template; you can apply it to all departments or select specific target departments manually.'
                      )}
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Cycle Name (AR & EN) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{txt('اسم الدورة بالعربية *', 'AR Cycle Name *')}</label>
                  <input 
                    type="text"
                    required
                    value={cycleForm.nameAr}
                    onChange={(e) => setCycleForm({...cycleForm, nameAr: e.target.value})}
                    placeholder="مثال: التقييم السنوي لعام 2026"
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-500 font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{txt('اسم الدورة بالإنجليزية *', 'EN Cycle Name *')}</label>
                  <input 
                    type="text"
                    required
                    value={cycleForm.nameEn}
                    onChange={(e) => setCycleForm({...cycleForm, nameEn: e.target.value})}
                    placeholder="e.g. Annual Assessment 2026"
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-500 font-bold"
                  />
                </div>
              </div>

              {/* Cycle Type & Fiscal Year */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{txt('نوع تكليف الدورة *', 'Appraisal Type *')}</label>
                  <select 
                    value={cycleForm.cycleType}
                    onChange={(e) => setCycleForm({...cycleForm, cycleType: e.target.value})}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 font-bold"
                  >
                    <option value="Annual">Annual Appraisal (تقييم سنوي)</option>
                    <option value="Mid-Year">Mid-Year Review (مراجعة نصف سنوية)</option>
                    <option value="Probationary">Probationary Period (فترة تجربة)</option>
                    <option value="Special">Special Action (تقييم استثنائي / خاص)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{txt('سنة التكليف المالي *', 'Cycle Year *')}</label>
                  <input 
                    type="text"
                    required
                    value={cycleForm.year}
                    onChange={(e) => setCycleForm({...cycleForm, year: e.target.value})}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl tracking-wider font-mono text-center focus:outline-none text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 font-bold"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{txt('تاريخ البداية (فعلي) *', 'Start Date *')}</label>
                  <input 
                    type="date"
                    required
                    value={cycleForm.startDate}
                    onChange={(e) => setCycleForm({...cycleForm, startDate: e.target.value})}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block">{txt('تاريخ الانتهاء والمطابقة *', 'End Date *')}</label>
                  <input 
                    type="date"
                    required
                    value={cycleForm.endDate}
                    onChange={(e) => setCycleForm({...cycleForm, endDate: e.target.value})}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 font-mono font-bold"
                  />
                </div>
              </div>

              {/* Target Departments Section */}
              <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>{txt('نطاق الإدارات والموظفين المستهدفين', 'Department Targeting Scope')}</span>
                  </label>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {txt(`الموظفون النشطون المشمولون: ${activeCycleEmployees.length} موظف`, `Target Active Employees: ${activeCycleEmployees.length}`)}
                  </span>
                </div>

                {selectedTemplateDeptInfo.isSpecific ? (
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-black text-foreground">
                        {txt(`مقيد بإدارة: ${selectedTemplateDeptInfo.deptNames}`, `Locked to: ${selectedTemplateDeptInfo.deptNames}`)}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full">
                      {txt(`${activeCycleEmployees.length} موظف نشط`, `${activeCycleEmployees.length} active`)}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCycleForm(prev => ({ ...prev, departmentScope: 'all', targetDepartments: [] }))}
                        className={`p-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition-all ${
                          cycleForm.departmentScope === 'all'
                            ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <Globe className="w-4 h-4" />
                        <span>{txt('تعميم لكافة الإدارات', 'All Departments')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCycleForm(prev => ({ ...prev, departmentScope: 'specific' }))}
                        className={`p-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 border transition-all ${
                          cycleForm.departmentScope === 'specific'
                            ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-300 shadow-sm'
                            : 'bg-white dark:bg-slate-800 border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <Building2 className="w-4 h-4" />
                        <span>{txt('تحديد إدارات معينة', 'Specific Departments')}</span>
                      </button>
                    </div>

                    {cycleForm.departmentScope === 'specific' && (
                      <div className="space-y-2 p-3 bg-white dark:bg-slate-800 rounded-xl border border-border">
                        <div className="flex items-center justify-between gap-2">
                          <div className="relative flex-1">
                            <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="text"
                              value={cycleSearchDept}
                              onChange={(e) => setCycleSearchDept(e.target.value)}
                              placeholder={txt('بحث في الإدارات المتاحة...', 'Search departments...')}
                              className="w-full text-xs pr-8 pl-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const allIds = adminDepartments.map(d => d.id);
                              setCycleForm(prev => ({
                                ...prev,
                                targetDepartments: prev.targetDepartments.length === allIds.length ? [] : allIds
                              }));
                            }}
                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline px-1 shrink-0"
                          >
                            {cycleForm.targetDepartments.length === adminDepartments.length
                              ? txt('إلغاء الكل', 'Deselect All')
                              : txt('تحديد الكل', 'Select All')
                            }
                          </button>
                        </div>

                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/40">
                          {adminDepartments
                            .filter(d => !cycleSearchDept || d.name.toLowerCase().includes(cycleSearchDept.toLowerCase()))
                            .map(dept => {
                              const isChecked = cycleForm.targetDepartments.includes(dept.id);
                              const deptActiveEmpsCount = employees.filter(e => e.departmentId === dept.id && e.status === 'Active' && (e as any).exemptFromAppraisal !== 'Yes').length;
                              return (
                                <label
                                  key={dept.id}
                                  className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-colors ${
                                    isChecked ? 'bg-blue-50/70 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setCycleForm(prev => ({
                                            ...prev,
                                            targetDepartments: [...prev.targetDepartments, dept.id]
                                          }));
                                        } else {
                                          setCycleForm(prev => ({
                                            ...prev,
                                            targetDepartments: prev.targetDepartments.filter(id => id !== dept.id)
                                          }));
                                        }
                                      }}
                                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
                                    />
                                    <span className="text-xs font-bold text-foreground">{dept.name}</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-muted-foreground font-mono">
                                    {deptActiveEmpsCount} {txt('موظف', 'emps')}
                                  </span>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Optional Self-Evaluation Checkbox */}
              <div className="flex items-center gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-border">
                <input 
                  type="checkbox"
                  id="requireSelfEval"
                  checked={cycleForm.requireSelfEval}
                  onChange={(e) => setCycleForm({...cycleForm, requireSelfEval: e.target.checked})}
                  className="w-4.5 h-4.5 text-blue-600 border-slate-300 dark:border-slate-700 rounded cursor-pointer accent-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="requireSelfEval" className="text-xs font-black text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  {txt('تفعيل التقييم الذاتي من قبل الموظف كمتطلب أساسي', 'Enable self-evaluation as an initial requirement from the employee')}
                </label>
              </div>

              <div className="space-y-1 pt-3">
                <button 
                  type="submit"
                  disabled={isActionPending}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-xs transition-all active:scale-95 duration-100 shadow-md animate-in fade-in flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {isActionPending 
                      ? txt('جاري المعالجة وإدراج السند...', 'Saving Docket...') 
                      : (editingCycleId 
                          ? txt('تعديل وحفظ بيانات الدورة الحالية', 'Save and apply cycle changes') 
                          : txt('إنشاء دورة التقييم وحفظ القالب كمسودة', 'Create cycle and link template')
                        )
                    }
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG 2: ADD NEW PERFORMANCE CRITERION */}
      {isCriteriaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl p-6 w-full max-w-md shadow-xl text-right max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setIsCriteriaModalOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
              <h2 className="text-lg font-black">{editingCriteriaId ? txt('تعديل معيار التقييم الفردي', 'Edit Individual Criteria') : txt('إضافة معيار تقييم جديد', 'Add Evaluation Criteria')}</h2>
            </div>

            <form onSubmit={handleCreateCriteria} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block">{txt('نوع المعيار والربط بالنظام الآلي *', 'Criterion System Link *')}</label>
                <select 
                  value={criteriaForm.criterionKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    const defaultCrit = DEFAULT_SYSTEM_CRITERIA.find(c => c.criterionKey === key);
                    setCriteriaForm({
                      ...criteriaForm,
                      criterionKey: key,
                      nameAr: defaultCrit ? defaultCrit.nameAr : criteriaForm.nameAr,
                      nameEn: defaultCrit ? defaultCrit.nameEn : criteriaForm.nameEn,
                      weight: defaultCrit ? defaultCrit.weight : criteriaForm.weight,
                      descriptionAr: defaultCrit ? defaultCrit.descriptionAr : criteriaForm.descriptionAr,
                      descriptionEn: defaultCrit ? defaultCrit.descriptionEn : criteriaForm.descriptionEn,
                      isAutoCalculated: key !== 'custom'
                    });
                  }}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="tasks">{txt('المهام وإنجاز الأعمال (إنجاز، تأخير، وقت مقدر وفعلي)', 'Tasks & Deliverables (Completion, Delays, Est vs Actual)')}</option>
                  <option value="missions">{txt('المأموريات والمهام الخارجية (يُستبعد تلقائياً إذا لم توجد مأموريات)', 'Missions & Field Work (Auto-excluded if None)')}</option>
                  <option value="attendance">{txt('الحضور والانصراف وساعات العمل', 'Attendance & Working Hours')}</option>
                  <option value="leaves">{txt('الالتزام بسياسات الإجازات والانضباط', 'Leaves & Absence Policy Compliance')}</option>
                  <option value="wfh">{txt('طلبات العمل من المنزل والإنتاجية', 'Work From Home (WFH) Requests')}</option>
                  <option value="investigations">{txt('التحقيقات الإدارية والمساءلات', 'Administrative Investigations')}</option>
                  <option value="penalties">{txt('الجزاءات والمخالفات الانضباطية', 'Penalties & Disciplinary Infractions')}</option>
                  <option value="custom">{txt('معيار نوعي / مخصص إضافي', 'Custom Qualitative Criterion')}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block">{txt('اسم المعيار بالعربية *', 'AR Index Name *')}</label>
                <input 
                  type="text"
                  required
                  value={criteriaForm.nameAr}
                  onChange={(e) => setCriteriaForm({...criteriaForm, nameAr: e.target.value})}
                  placeholder="مثال: الانضباط بتسليم المهام"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block">{txt('اسم المعيار بالإنجليزية *', 'EN Index Name *')}</label>
                <input 
                  type="text"
                  required
                  value={criteriaForm.nameEn}
                  onChange={(e) => setCriteriaForm({...criteriaForm, nameEn: e.target.value})}
                  placeholder="e.g. Tasks Execution & Timeliness"
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-left focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">{txt('تنسيق وقيمة الرد *', 'Format Type *')}</label>
                  <select 
                    value={criteriaForm.responseType}
                    onChange={(e) => setCriteriaForm({...criteriaForm, responseType: e.target.value})}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="RatingStar">5-Star Star Rating</option>
                    <option value="RatingTen">1-10 Value Rating</option>
                    <option value="YesNo">Yes/No Index</option>
                    <option value="Text">Open Essay / Text</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">{txt('الوزن النسبي (%) *', 'Base Weight % *')}</label>
                  <input 
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={criteriaForm.weight}
                    onChange={(e) => setCriteriaForm({...criteriaForm, weight: Number(e.target.value)})}
                    className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-center focus:outline-none text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Toggles for Auto-Calculation & Enablement */}
              <div className="space-y-2 p-3 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center justify-between">
                  <label htmlFor="isAutoCalcToggle" className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-blue-600" />
                    <span>{txt('احتساب آلي تلقائي من سجلات النظام', 'Auto-calculate from system activity')}</span>
                  </label>
                  <input 
                    type="checkbox"
                    id="isAutoCalcToggle"
                    checked={criteriaForm.isAutoCalculated}
                    onChange={(e) => setCriteriaForm({...criteriaForm, isAutoCalculated: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded cursor-pointer accent-blue-600"
                  />
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <label htmlFor="isEnabledToggle" className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{txt('تفعيل المعيار في نماذج التقييم', 'Enable criterion for appraisal templates')}</span>
                  </label>
                  <input 
                    type="checkbox"
                    id="isEnabledToggle"
                    checked={criteriaForm.isEnabled}
                    onChange={(e) => setCriteriaForm({...criteriaForm, isEnabled: e.target.checked})}
                    className="w-4 h-4 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block">{txt('الشرح والتوضيح الفني المعياري', 'Glossary / Instructions')}</label>
                <textarea 
                  value={criteriaForm.descriptionAr}
                  onChange={(e) => setCriteriaForm({...criteriaForm, descriptionAr: e.target.value})}
                  rows={2}
                  className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-blue-500"
                  placeholder="تقديم نصائح للموظف والمدير لتحديد هذا المستهدف..."
                />
              </div>

              <button 
                type="submit"
                disabled={isActionPending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-xs cursor-pointer shadow-md"
              >
                {txt('حفظ وتثبيت المعيار المستهدف', 'Save index criteria')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG 3: ADD / EDIT EVALUATION TEMPLATE */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl p-6 w-full max-w-xl shadow-xl text-right animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-border/60 pb-3">
              <button onClick={() => setIsTemplateModalOpen(false)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              <h2 className="text-base font-black text-foreground">
                {editingTemplate 
                  ? txt('تعديل قالب استمارة التقييم', 'Edit Evaluation Template') 
                  : txt('تصميم قالب استمارة تقييم متوازنة', 'Dynamic Template Builder')}
              </h2>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground block">{txt('اسم القالب بالعربية *', 'AR Template Name *')}</label>
                  <input 
                    type="text"
                    required
                    value={templateForm.nameAr}
                    onChange={(e) => setTemplateForm({...templateForm, nameAr: e.target.value})}
                    placeholder="مثال: قالب أداء الكوادر الفنية"
                    className="w-full text-xs p-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground block">{txt('اسم القالب بالإنجليزية *', 'EN Template Name *')}</label>
                  <input 
                    type="text"
                    required
                    value={templateForm.nameEn}
                    onChange={(e) => setTemplateForm({...templateForm, nameEn: e.target.value})}
                    placeholder="e.g. Technical Staff Performance Shield"
                    className="w-full text-xs p-2.5 bg-muted/50 border border-border rounded-xl text-left focus:outline-none text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Department Scope / Targeting Section */}
              <div className="space-y-2 p-3.5 bg-muted/40 rounded-xl border border-border/80">
                <label className="text-xs font-black text-foreground block flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>{txt('تطبيق ونطاق القالب حسب الإدارات (Department Scope)', 'Template Department Scope')}</span>
                </label>
                
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setTemplateForm({ ...templateForm, departmentScope: 'all', targetDepartments: ['all'] })}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      templateForm.departmentScope === 'all'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-950 dark:text-emerald-300 font-bold ring-1 ring-emerald-500'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-black flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-emerald-600" />
                        {txt('تعميم على الكل', 'General (All)')}
                      </span>
                      <input
                        type="radio"
                        name="deptScope"
                        checked={templateForm.departmentScope === 'all'}
                        onChange={() => {}}
                        className="accent-emerald-600"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {txt('يكون هذا النموذج متاحاً وشاملاً لكافة الإدارات والقطاعات دون استثناء.', 'Applicable across all departments and units.')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const curr = templateForm.targetDepartments.filter(id => id !== 'all');
                      setTemplateForm({ ...templateForm, departmentScope: 'specific', targetDepartments: curr });
                    }}
                    className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      templateForm.departmentScope === 'specific'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-950 dark:text-blue-300 font-bold ring-1 ring-blue-500'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-xs font-black flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        {txt('تخصيص لإدارات معينة', 'Specific Departments')}
                      </span>
                      <input
                        type="radio"
                        name="deptScope"
                        checked={templateForm.departmentScope === 'specific'}
                        onChange={() => {}}
                        className="accent-blue-600"
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {txt('يُخصص النموذج حصرياً لموظفي إدارات محددة يختارها مسؤول الموارد البشرية.', 'Restrict template to specified administrative departments.')}
                    </span>
                  </button>
                </div>

                {/* Specific Department Checkboxes Multi-Selector */}
                {templateForm.departmentScope === 'specific' && (
                  <div className="mt-3 p-3 bg-background border border-border rounded-xl space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                      <span className="text-xs font-bold text-foreground">
                        {txt('اختر الإدارات المستهدفة بهذا النموذج:', 'Select target departments:')}
                        <span className="text-[10px] text-blue-600 mr-1 rtl:ml-1 font-mono font-black">
                          ({templateForm.targetDepartments.filter(id => id !== 'all').length} / {adminDepartments.length})
                        </span>
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setTemplateForm({ ...templateForm, targetDepartments: adminDepartments.map(d => d.id) })}
                          className="text-[10px] text-blue-600 hover:underline font-bold"
                        >
                          {txt('تحديد الكل', 'Select All')}
                        </button>
                        <span className="text-muted-foreground text-[10px]">|</span>
                        <button
                          type="button"
                          onClick={() => setTemplateForm({ ...templateForm, targetDepartments: [] })}
                          className="text-[10px] text-rose-600 hover:underline font-bold"
                        >
                          {txt('إلغاء التحديد', 'Clear')}
                        </button>
                      </div>
                    </div>

                    {/* Department Search Bar */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute right-2.5 rtl:left-2.5 top-2.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={templateSearchDept}
                        onChange={(e) => setTemplateSearchDept(e.target.value)}
                        placeholder={txt('بحث باسم الإدارة...', 'Search department...')}
                        className="w-full text-[11px] py-1.5 px-7 bg-muted/40 border border-border rounded-lg text-foreground focus:outline-none"
                      />
                    </div>

                    {/* Department Grid List */}
                    <div className="max-h-[140px] overflow-y-auto space-y-1 pr-1 text-right">
                      {adminDepartments
                        .filter(d => !templateSearchDept || d.name?.toLowerCase().includes(templateSearchDept.toLowerCase()))
                        .map(dept => {
                          const isChecked = templateForm.targetDepartments.includes(dept.id);
                          return (
                            <label
                              key={dept.id}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                                isChecked ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold' : 'hover:bg-muted text-foreground'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    let updated = [...templateForm.targetDepartments.filter(id => id !== 'all')];
                                    if (isChecked) {
                                      updated = updated.filter(id => id !== dept.id);
                                    } else {
                                      updated.push(dept.id);
                                    }
                                    setTemplateForm({ ...templateForm, targetDepartments: updated });
                                  }}
                                  className="rounded border-border accent-blue-600 focus:ring-blue-500"
                                />
                                <span>{dept.name}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {`#${dept.id.slice(0, 4)}`}
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground block">{txt('درجة الاستحقاق والحد الأدنى للنجاح (%)', 'Success Threshold rate %')}</label>
                  <input 
                    type="number"
                    min="30"
                    max="100"
                    value={templateForm.successRate}
                    onChange={(e) => setTemplateForm({...templateForm, successRate: Number(e.target.value)})}
                    className="w-full text-xs p-2.5 bg-muted/50 border border-border rounded-xl text-center font-mono focus:outline-none text-foreground focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground block">{txt('مرحلة التقييم الذاتي للموظف', 'Employee Self Evaluation Stage')}</label>
                  <label className="flex items-center gap-2 p-2.5 bg-muted/50 border border-border rounded-xl cursor-pointer hover:bg-muted transition-colors">
                    <input 
                      type="checkbox"
                      checked={templateForm.requireSelfEval}
                      onChange={(e) => setTemplateForm({...templateForm, requireSelfEval: e.target.checked})}
                      className="rounded border-border accent-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-foreground">
                      {txt('إلزام الموظف بالتقييم الذاتي أولاً', 'Require Self-Evaluation First')}
                    </span>
                  </label>
                </div>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl space-y-3 border border-border/80">
                <span className="text-xs font-black block text-foreground">{txt('ربط معايير السلوك بقسم الاستمارة', 'Hook Criteria to appraisal sections')}</span>
                <div className="max-h-[160px] overflow-y-auto space-y-1 text-right">
                  {performanceCriteria.map(cri => {
                    const isSelected = templateForm.sections[0].criteriaIds.includes(cri.id);
                    return (
                      <label key={cri.id} className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted text-xs text-foreground">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            let currIds = [...templateForm.sections[0].criteriaIds];
                            if (isSelected) {
                              currIds = currIds.filter(id => id !== cri.id);
                            } else {
                              currIds.push(cri.id);
                            }
                            const updatedSects = [{ ...templateForm.sections[0], criteriaIds: currIds }];
                            setTemplateForm({ ...templateForm, sections: updatedSects });
                          }}
                          className="rounded border-border accent-blue-600 focus:ring-blue-500"
                        />
                        <span>{isRtl ? cri.nameAr : cri.nameEn} ({cri.weight}%)</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button 
                type="submit"
                disabled={isActionPending}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-xs shadow-md transition-all active:scale-98"
              >
                {editingTemplate 
                  ? txt('تحديث وحفظ القالب', 'Update Template') 
                  : txt('حفظ وتشييد استمارة التقييم', 'Compile and lock template builder')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG 4: CORE APPRAISE & SELF APPRAISE RATING MODAL */}
      {isEvaluationModalOpen && selectedEvaluation && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card text-card-foreground border border-border rounded-2xl p-6 w-full max-w-4xl shadow-2xl text-right max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-border/80">
              <button 
                onClick={() => {
                  setIsEvaluationModalOpen(false);
                  setSelectedEvaluation(null);
                }} 
                className="p-1.5 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-black text-foreground">
                  {selectedEvaluation.employeeId === employeeId 
                    ? txt('استمارة التقييم الذاتي للموظف', 'Employee Self-Appraisal Form') 
                    : txt('استمارة تقييم ومراجعة أداء الموظف', 'Performance Appraisal Assessment Form')
                  }
                </h2>
              </div>
            </div>

            <form onSubmit={(e) => handleSubmitEvaluationRating(e, 'PendingApproval')} className="space-y-6">
              {/* EMPLOYEE CONTEXT INFO CARD */}
              <div className="p-4 bg-muted/40 border border-border/70 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-bold block">{txt('الموظف المعني بالتقييم:', 'Employee Name:')}</span>
                  <p className="font-black text-foreground flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-600" />
                    {employees.find(e => e.id === selectedEvaluation.employeeId)?.name || '---'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-bold block">{txt('دورة التقييم السنوية:', 'Appraisal Cycle:')}</span>
                  <p className="font-black text-foreground flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    {performanceCycles.find(c => c.id === selectedEvaluation.cycleId)?.nameAr || '---'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground font-bold block">{txt('حالة الاستمارة الحالية:', 'Current Evaluation Status:')}</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-blue-500/15 text-blue-700 dark:text-blue-300 rounded-full font-black text-[11px]">
                      {selectedEvaluation.status || 'PendingSelf'}
                    </span>
                    {selectedEvaluation.isSelfSubmitted && (
                      <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-full font-bold text-[10px]">
                        {txt('✓ التقييم الذاتي مكتمل', 'Self Eval Done')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* RETURN REASON WARNING ALERT */}
              {selectedEvaluation.returnReason && (selectedEvaluation.status === 'Returned for Re-evaluation' || selectedEvaluation.status === 'Returned') && (
                <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl space-y-1.5 text-right animate-in fade-in">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-black text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{txt('ملاحظات وسجل سبب إعادة التقييم من الرئيس الأعلى:', 'Return for Re-evaluation Notes:')}</span>
                  </div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200 pr-6 leading-relaxed">
                    {selectedEvaluation.returnReason}
                  </p>
                </div>
              )}

              {/* AUTOMATED AI & OPERATIONAL SCORING BANNER */}
              {autoScoreResult && (
                <div className="p-5 bg-gradient-to-br from-indigo-500/5 via-blue-500/5 to-purple-500/5 border border-indigo-500/20 rounded-2xl space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-indigo-500 text-white rounded-xl shadow-sm">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-foreground flex items-center gap-2">
                          {txt('نتائج الاحتساب الآلي الذكي من بيانات التشغيل والأنظمة', 'System Automated Operational Performance Score')}
                          <span className="px-2 py-0.5 text-[10px] font-mono bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 rounded-md font-black">
                            100% {txt('موازنة ديناميكية', 'Dynamic Normalization')}
                          </span>
                        </h4>
                        <p className="text-[10px] text-muted-foreground">
                          {txt('احتساب فوري يعتمد على المهام المنجزة، الحضور، الإجازات، المأموريات، وسجل الانضباط.', 'Real-time calculation based on tasks, attendance, leaves, missions, and disciplinary records.')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <div className="text-center px-3 py-1 bg-background border border-border rounded-xl shadow-xs">
                        <span className="text-[10px] text-muted-foreground font-bold block">{txt('النسبة التلقائية', 'Auto Score')}</span>
                        <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono">
                          {autoScoreResult.overallScore}%
                        </span>
                      </div>
                      <div className="text-center px-3 py-1 bg-background border border-border rounded-xl shadow-xs">
                        <span className="text-[10px] text-muted-foreground font-bold block">{txt('التقدير العام', 'Grade')}</span>
                        <span className={`text-xs font-black px-2 py-0.5 rounded-md inline-block ${autoScoreResult.finalGrade.badgeClass}`}>
                          {isRtl ? autoScoreResult.finalGrade.ar : autoScoreResult.finalGrade.en}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* QUICK APPLY AUTO RATINGS BUTTON & TOGGLE */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-indigo-500/10">
                    <button
                      type="button"
                      onClick={handleApplyAutoScores}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      {txt('تطبيق درجات النظام التلقائية على الاستمارة (1-Click Fill)', 'Apply System Scores to Rating Matrix')}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAutoScoreBreakdown(!showAutoScoreBreakdown)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>{showAutoScoreBreakdown ? txt('إخفاء تفاصيل المعايير', 'Hide Criteria Details') : txt('عرض تفاصيل احتساب كل معيار', 'Show Criteria Details')}</span>
                    </button>
                  </div>

                  {/* EXPANDABLE BREAKDOWN CARDS */}
                  {showAutoScoreBreakdown && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 animate-in fade-in">
                      {autoScoreResult.criteriaResults.map(cr => (
                        <div 
                          key={cr.criterionId || cr.criterionKey} 
                          className={`p-3 rounded-xl border text-right space-y-1.5 ${
                            !cr.isApplicable 
                              ? 'bg-purple-500/5 border-purple-500/20 text-purple-900 dark:text-purple-300' 
                              : 'bg-background border-border text-foreground'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-black text-xs flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5 text-indigo-500" />
                              {isRtl ? cr.nameAr : cr.nameEn}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {txt('الوزن:', 'Weight:')} {cr.configuredWeight}%
                                {cr.effectiveWeight !== cr.configuredWeight && (
                                  <span className="text-indigo-600 font-bold mr-1 rtl:ml-1">
                                    → {cr.effectiveWeight}%
                                  </span>
                                )}
                              </span>
                              {cr.isApplicable ? (
                                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black rounded-md font-mono">
                                  {cr.score}%
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black rounded-md">
                                  {txt('مستبعد (0 مأموريات)', 'Excluded (0 Missions)')}
                                </span>
                              )}
                            </div>
                          </div>

                          {!cr.isApplicable ? (
                            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/10 p-2 rounded-lg leading-relaxed">
                              ✨ {cr.notApplicableReason || txt('لا توجد مأموريات مسندة للموظف: تم استبعاد المعيار وإعادة موازنة الوزن النسبي لباقي المعايير بنجاح دون أي تأثير سلبي على التقييم.', 'No missions assigned. Metric excluded and weight balanced with zero negative impact.')}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.max(5, Math.min(100, cr.score))}%` }}
                                />
                              </div>
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {cr.details.map((d, dIdx) => (
                                  <span key={dIdx} className="text-[10px] px-1.5 py-0.5 bg-muted/70 text-muted-foreground rounded font-mono">
                                    {isRtl ? d.labelAr : d.labelEn}: <strong className="text-foreground font-bold">{d.value}</strong>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ITERATE THROUGH CONNECTED CRITERIAS WITH 5-STAR WORKSPACE */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-black text-foreground">
                    {txt('مصفوفة المعايير والسلوك المستهدف (تقييم النجوم 1-5)', 'Performance Criteria & Behavior Matrix (1-5 Stars)')}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {Object.keys(evaluationRatings).length} / {performanceCriteria.length} {txt('معايير مقيمة', 'Evaluated')}
                  </span>
                </div>
                
                {performanceCriteria.map((cri, idx) => {
                  const currRating = evaluationRatings[cri.id] || 0;
                  const matchingAuto = autoScoreResult?.criteriaResults?.find(b => 
                    (cri.criterionKey && b.criterionKey === cri.criterionKey) ||
                    b.criterionId === cri.id ||
                    b.nameAr === cri.nameAr
                  );

                  return (
                    <div key={cri.id} className="p-4 border border-border rounded-2xl bg-card hover:bg-muted/20 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="text-right flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-xs text-foreground">
                            {idx+1}. {isRtl ? cri.nameAr : cri.nameEn}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 rounded-md text-[10px] font-mono font-black">
                            {txt('الوزن:', 'Weight:')} {cri.weight}%
                          </span>
                          {matchingAuto && matchingAuto.isApplicable && (
                            <span className="px-2 py-0.5 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 rounded-md text-[10px] font-black font-mono">
                              ⚡ {txt('اقتراح النظام:', 'System:')} {matchingAuto.score}% ({Math.round(matchingAuto.score / 20)}★)
                            </span>
                          )}
                          {matchingAuto && !matchingAuto.isApplicable && (
                            <span className="px-2 py-0.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 rounded-md text-[10px] font-bold">
                              {txt('مستبعد وموازن (0 مأموريات)', 'Excluded')}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1 font-medium">
                          {isRtl ? cri.descriptionAr : cri.descriptionEn}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map(starVal => (
                            <button 
                              key={starVal}
                              type="button"
                              onClick={() => {
                                setEvaluationRatings({ ...evaluationRatings, [cri.id]: starVal });
                              }}
                              className="p-1 hover:scale-115 active:scale-95 transition-transform cursor-pointer"
                              title={`${starVal} / 5`}
                            >
                              <Star 
                                className={`w-6 h-6 transition-colors ${
                                  starVal <= currRating 
                                    ? 'text-amber-500 fill-amber-500 drop-shadow-xs' 
                                    : 'text-muted-foreground/30 hover:text-amber-400/60'
                                }`} 
                              />
                            </button>
                          ))}
                        </div>
                        <span className="text-xs font-mono font-black text-foreground min-w-[45px] text-left">
                          {currRating > 0 ? `${currRating * 20}%` : '--'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* COMMENTS AND QUALITATIVE FEEDBACK */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-black text-foreground block border-b border-border pb-2">
                  {txt('الملاحظات النوعية ومسارات التطوير', 'Qualitative Feedback & Growth Paths')}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground block">{txt('أهم نقاط القوة والتميز', 'Top Key Strengths')}</label>
                    <textarea 
                      value={evaluationFeedback.strengths}
                      onChange={(e) => setEvaluationFeedback({ ...evaluationFeedback, strengths: e.target.value })}
                      rows={2}
                      className="w-full text-xs p-2.5 bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground"
                      placeholder={txt('اكتب هنا مكامن التميز والإنجازات البارزة للموظف...', 'Type key performance highlights...')}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground block">{txt('مجالات التحسين وفرص تنشيط النمو', 'Identified Improvement Gaps')}</label>
                    <textarea 
                      value={evaluationFeedback.improvements}
                      onChange={(e) => setEvaluationFeedback({ ...evaluationFeedback, improvements: e.target.value })}
                      rows={2}
                      className="w-full text-xs p-2.5 bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground"
                      placeholder={txt('اكتب نقاط التطوير المستهدفة للدورة المقبلة...', 'Type targeted indicators for growth...')}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground block">{txt('التوصيات الختامية وبرنامج التدريب الموصى به', 'Closing Recommendations & Action Tracks')}</label>
                  <textarea 
                    value={evaluationFeedback.recommendations}
                    onChange={(e) => setEvaluationFeedback({ ...evaluationFeedback, recommendations: e.target.value })}
                    rows={2}
                    className="w-full text-xs p-2.5 bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-foreground"
                    placeholder={txt('توصيات ختامية ومقررات مضافة بملف الموظف...', 'Type general recommendation notes...')}
                  />
                </div>
              </div>

              {/* HIGHER MANAGER DECISION AND WORKFLOW ACTIONS */}
              {selectedEvaluation.status === 'PendingApproval' ? (
                <div className="p-5 bg-gradient-to-br from-emerald-500/5 via-blue-500/5 to-slate-500/5 border-2 border-emerald-500/30 rounded-2xl space-y-4 text-right animate-in fade-in">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-black text-sm">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <span>{txt('مركز قرار واعتماد الرئيس الأعلى (Higher Level Manager Decision)', 'Higher Manager Decision & Approval Center')}</span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {txt('يتيح النظام للرئيس الأعلى حرية الاختيار بين اعتماد التقييم الآلي، اعتماد تقييم المدير المباشر، أو تحديد نسبة مخصصة.', 'Choose whether to adopt system score, direct manager evaluation, or specify a custom percentage.')}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* OPTION 1: ADOPT SYSTEM */}
                    <button
                      type="button"
                      onClick={() => setHigherManagerDecisionChoice('AdoptSystem')}
                      className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                        higherManagerDecisionChoice === 'AdoptSystem'
                          ? 'bg-indigo-500/15 border-indigo-500 text-indigo-950 dark:text-indigo-200 font-bold ring-2 ring-indigo-500 shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-xs font-black flex items-center gap-1.5 text-indigo-600">
                          <Zap className="w-4 h-4" />
                          {txt('اعتماد تقييم النظام التلقائي', 'Adopt System Score')}
                        </span>
                        <input
                          type="radio"
                          name="higherDecision"
                          checked={higherManagerDecisionChoice === 'AdoptSystem'}
                          onChange={() => setHigherManagerDecisionChoice('AdoptSystem')}
                          className="accent-indigo-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-black font-mono text-indigo-600">
                          {autoScoreResult?.overallScore ?? selectedEvaluation.systemCalculatedScore ?? 85}%
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {txt('اعتماد النتيجة التلقائية المحسوبة من إنجازات التشغيل والحضور والمهام.', 'Adopt calculated operational performance score.')}
                        </p>
                      </div>
                    </button>

                    {/* OPTION 2: ADOPT DIRECT MANAGER */}
                    <button
                      type="button"
                      onClick={() => setHigherManagerDecisionChoice('AdoptManager')}
                      className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                        higherManagerDecisionChoice === 'AdoptManager'
                          ? 'bg-blue-500/15 border-blue-500 text-blue-950 dark:text-blue-200 font-bold ring-2 ring-blue-500 shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-xs font-black flex items-center gap-1.5 text-blue-600">
                          <User className="w-4 h-4" />
                          {txt('اعتماد تقييم المدير المباشر', 'Adopt Manager Rating')}
                        </span>
                        <input
                          type="radio"
                          name="higherDecision"
                          checked={higherManagerDecisionChoice === 'AdoptManager'}
                          onChange={() => setHigherManagerDecisionChoice('AdoptManager')}
                          className="accent-blue-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-black font-mono text-blue-600">
                          {Object.keys(evaluationRatings).length > 0 
                            ? `${Math.round((Object.values(evaluationRatings).reduce((a, b) => a + b, 0) / (Math.max(1, Object.keys(evaluationRatings).length) * 5)) * 100)}%`
                            : `${selectedEvaluation.finalPercentageScore || 80}%`}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {txt('اعتماد متوسط درجات التقييم التقديرية المسجلة من المدير المباشر.', 'Adopt direct manager star rating averages.')}
                        </p>
                      </div>
                    </button>

                    {/* OPTION 3: CUSTOM SCORE */}
                    <button
                      type="button"
                      onClick={() => setHigherManagerDecisionChoice('CustomScore')}
                      className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                        higherManagerDecisionChoice === 'CustomScore'
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-950 dark:text-emerald-200 font-bold ring-2 ring-emerald-500 shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-xs font-black flex items-center gap-1.5 text-emerald-600">
                          <Edit3 className="w-4 h-4" />
                          {txt('تحديد نسبة ودرجة مخصصة', 'Custom Score')}
                        </span>
                        <input
                          type="radio"
                          name="higherDecision"
                          checked={higherManagerDecisionChoice === 'CustomScore'}
                          onChange={() => setHigherManagerDecisionChoice('CustomScore')}
                          className="accent-emerald-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-black font-mono text-emerald-600">
                          {higherManagerCustomScore}%
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {txt('تحديد نسبة استثنائية معتمدة مباشرة من الرئيس الأعلى.', 'Override with a custom percentage approved by higher management.')}
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* CUSTOM SCORE INPUT WHEN SELECTED */}
                  {higherManagerDecisionChoice === 'CustomScore' && (
                    <div className="p-3 bg-background border border-border rounded-xl space-y-2 animate-in fade-in">
                      <label className="text-xs font-bold text-foreground block">
                        {txt('النسبة المئوية المخصصة من الرئيس الأعلى (0 - 100%):', 'Custom Percentage Score (0 - 100%):')}
                      </label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={higherManagerCustomScore}
                          onChange={(e) => setHigherManagerCustomScore(Math.max(0, Math.min(100, Number(e.target.value))))}
                          className="w-32 text-center text-sm font-black font-mono p-2 bg-muted border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 text-foreground"
                        />
                        <span className="text-xs font-bold text-muted-foreground">
                          {txt('التقدير المقابل:', 'Equivalent Grade:')}{' '}
                          <strong className="text-emerald-600 font-black">
                            {isRtl ? getPerformanceGrade(higherManagerCustomScore).ar : getPerformanceGrade(higherManagerCustomScore).en}
                          </strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* HIGHER MANAGER NOTES */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-muted-foreground block">
                      {txt('ملاحظات ومبررات قرار الرئيس الأعلى (اختياري):', 'Higher Manager Decision Rationale / Notes:')}
                    </label>
                    <textarea 
                      value={higherManagerNotes}
                      onChange={(e) => setHigherManagerNotes(e.target.value)}
                      rows={2}
                      className="w-full text-xs p-2.5 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-foreground"
                      placeholder={txt('اكتب أسباب ومبررات القرار المعتمد النهائي هنا...', 'Type final decision justification notes...')}
                    />
                  </div>

                  {/* HIGHER MANAGER ACTION BUTTONS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button 
                      type="button"
                      disabled={isActionPending}
                      onClick={() => handleHigherManagerDecision(selectedEvaluation, higherManagerDecisionChoice)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-xs tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {txt('اعتماد وتثبيت النتيجة النهائية رسمياً', 'Approve with Selected Decision')}
                    </button>
                    <button 
                      type="button"
                      disabled={isActionPending}
                      onClick={() => setReturnModalState({ isOpen: true, evalId: selectedEvaluation.id, reason: '' })}
                      className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-xs tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {txt('إعادة التقييم للمدير المباشر مع الملاحظات', 'Return for Re-evaluation to Direct Manager')}
                    </button>
                  </div>
                </div>
              ) : (
                /* DIRECT MANAGER DISPATCH ACTIONS */
                <div className="pt-4 border-t border-border space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button 
                      type="button"
                      disabled={isActionPending}
                      onClick={(e) => handleSubmitEvaluationRating(e, 'PendingApproval')}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-xs tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                    >
                      <Send className="w-4 h-4" />
                      {txt('إرسال للرئيس الأعلى للاعتماد', 'Submit to Higher Manager for Approval')}
                    </button>
                    <button 
                      type="button"
                      disabled={isActionPending}
                      onClick={(e) => handleSubmitEvaluationRating(e, 'Approved')}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black py-2.5 rounded-xl text-xs tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                    >
                      <CheckCircle className="w-4 h-4" />
                      {txt('اعتماد التقييم مباشرة وتثبيته', 'Direct Approve Evaluation')}
                    </button>
                  </div>
                </div>
              )}

              {/* AUDIT TRAIL TIMELINE DISPLAY */}
              {Array.isArray(selectedEvaluation.auditTrail) && selectedEvaluation.auditTrail.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <span className="text-xs font-black text-muted-foreground block">
                    {txt('سجل الاعتمادات والتنقلات (Audit Trail):', 'Approval Audit Trail History:')}
                  </span>
                  <div className="space-y-2 bg-muted/40 p-4 rounded-xl border border-border max-h-48 overflow-y-auto">
                    {selectedEvaluation.auditTrail.map((log: AuditTrailEntry, idx: number) => (
                      <div key={idx} className="flex items-start justify-between text-[11px] pb-2 border-b border-border/50 last:border-0 last:pb-0">
                        <div>
                          <span className="font-bold text-foreground block">{log.action} ({log.userName})</span>
                          {log.comment && <p className="text-muted-foreground text-[10px] mt-0.5">{log.comment}</p>}
                        </div>
                        <span className="text-muted-foreground font-semibold dir-ltr text-[10px] font-mono">{new Date(log.timestamp).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* MODAL FOR RETURN REASON */}
      {returnModalState.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl text-right animate-in fade-in zoom-in-95 space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              {txt('سبب إعادة التقييم للمدير المباشر (إجباري)', 'Reason for Returning Evaluation (Mandatory)')}
            </h3>
            <p className="text-xs text-slate-500">
              {txt('يرجى توضيح النقاط أو المعايير المطلوب من المدير المباشر تعديلها أو إعادة تقييمها.', 'Please clarify the points or metrics requiring re-assessment.')}
            </p>
            <textarea
              required
              rows={3}
              value={returnModalState.reason}
              onChange={(e) => setReturnModalState({ ...returnModalState, reason: e.target.value })}
              className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              placeholder={txt('اكتب ملاحظات وسبب إرجاع التقييم هنا...', 'Write detailed return reason...')}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (selectedEvaluation) {
                    handleHigherManagerDecision(selectedEvaluation, 'Return', returnModalState.reason);
                  }
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black py-2 rounded-xl text-xs shadow-md cursor-pointer"
              >
                {txt('تأكيد الإعادة للمدير المباشر', 'Confirm Return')}
              </button>
              <button
                type="button"
                onClick={() => setReturnModalState({ isOpen: false, evalId: '', reason: '' })}
                className="px-4 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 rounded-xl text-xs cursor-pointer"
              >
                {txt('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL CONFIRM DIALOG FOR MODAL ACTIONS */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
};
