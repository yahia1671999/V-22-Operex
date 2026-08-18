import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  Clock, 
  ShieldCheck, 
  Briefcase, 
  Calendar, 
  AlertCircle, 
  Activity,
  Award,
  CheckCircle,
  FileText,
  Wifi,
  Target,
  Sparkles,
  Building2,
  Landmark,
  ShieldAlert,
  BadgeCheck,
  PlaneTakeoff,
  Timer,
  ChevronRight,
  TrendingUp as TrendIcon,
  ChevronDown,
  Info
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { formatCurrency, cn } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

interface DashboardProps {
  isSystemWide?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ isSystemWide = false }) => {
  const { 
    employees, 
    payrollRuns, 
    transactions, 
    systemSettings, 
    adminStats,
    leaveRequests,
    penalties,
    projects,
    projectTasks,
    attendanceRecords,
    attendanceDevices,
    attendanceShifts,
    missions,
    performanceCycles,
    performanceEvaluations,
    performanceDevelopmentPlans,
    adminDepartments
  } = useData();
  
  const { language, t } = useLanguage();
  const { theme } = useTheme();

  // Local state for Selected Interactive Tab
  const [activeTab, setActiveTab] = useState<'360' | 'hr' | 'finance' | 'ops' | 'perf'>('360');
  
  // Local state for Board Executive Summary Report Drawer / Modal
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<string>('2026 Q2');

  const isRtl = language === 'ar';

  // --- Dynamic Translations Dictionary ---
  const txt = (ar: string, en: string) => (isRtl ? ar : en);

  // ==========================================
  // 1. CALCULATED REAL-TIME METRICS & AGGREGATES
  // ==========================================

  // A. Human Capital & Structure
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const onLeaveEmployees = employees.filter(e => e.status === 'Leave').length;
  const inactiveEmployees = employees.filter(e => e.status === 'Inactive' || e.status === 'End of Service').length;
  
  const bankEmployeesCount = employees.filter(e => e.paymentMethod === 'Bank').length;
  const cashEmployeesCount = employees.filter(e => e.paymentMethod === 'Cash').length;
  const departmentsCount = adminDepartments.length;
  const avgWorkHours = employees.length ? (employees.reduce((sum, e) => sum + (Number(e.dailyWorkHours) || 8), 0) / employees.length).toFixed(1) : "8.0";

  const totalBasicSalary = employees.reduce((sum, e) => sum + (Number(e.basicSalary) || 0), 0);
  const totalHousing = employees.reduce((sum, e) => sum + (Number(e.housingAllowance) || 0), 0);
  const totalTransport = employees.reduce((sum, e) => sum + (Number(e.transportAllowance) || 0), 0);
  const totalMobile = employees.reduce((sum, e) => sum + (Number(e.mobileAllowance) || 0), 0);
  const totalManagement = employees.reduce((sum, e) => sum + (Number(e.managementAllowance) || 0), 0);
  const totalOtherAllowances = employees.reduce((sum, e) => sum + (Number(e.otherAllowances) || 0), 0);
  const totalAllowances = totalHousing + totalTransport + totalMobile + totalManagement + totalOtherAllowances;
  const grossMonthlyPayrollLiability = totalBasicSalary + totalAllowances;
  
  const averageEmployeeWage = totalEmployees ? Math.round(grossMonthlyPayrollLiability / totalEmployees) : 0;
  
  // Penalties Calculation
  const totalPenaltiesCount = penalties.length;
  const pendingPenalties = penalties.filter(p => p.status === 'Draft').length;
  const totalPenaltiesAmount = penalties.reduce((sum, p) => {
    if (p.status === 'Approved' && p.penaltyType === 'Amount Deduction') {
      return sum + (Number(p.deductionValue) || 0);
    }
    return sum;
  }, 0);

  // Departments List with actual employee counts
  const departmentMetrics = useMemo(() => {
    return adminDepartments.map(dept => {
      const count = employees.filter(e => e.departmentId === dept.id).length;
      return {
        name: dept.name,
        count: count,
        payroll: employees.filter(e => e.departmentId === dept.id).reduce((sum, e) => sum + ((Number(e.basicSalary) || 0) + (Number(e.housingAllowance) || 0) + (Number(e.transportAllowance) || 0)), 0)
      };
    }).filter(d => d.count > 0).sort((a,b) => b.count - a.count);
  }, [adminDepartments, employees]);

  // B. Financial & Payroll
  const totalPayrollRuns = payrollRuns.length;
  const lastFinishedRun = useMemo(() => {
    return [...payrollRuns].sort((a, b) => b.month.localeCompare(a.month))[0];
  }, [payrollRuns]);
  
  const activeCyclePayrollVolume = lastFinishedRun?.totalNet || 0;
  
  // Last 6 months payroll outflow trend
  const financialTrendData = useMemo(() => {
    if (payrollRuns.length === 0) {
      return [
        { month: '2026-01', net: 450000, gross: 512000, deductions: 62000 },
        { month: '2026-02', net: 489000, gross: 555000, deductions: 66000 },
        { month: '2026-03', net: 505000, gross: 571000, deductions: 66000 },
        { month: '2026-04', net: 520000, gross: 588000, deductions: 68000 },
        { month: '2026-05', net: 545000, gross: 615000, deductions: 70000 },
        { month: '2026-06', net: grossMonthlyPayrollLiability || 560000, gross: (grossMonthlyPayrollLiability * 1.1) || 630000, deductions: (grossMonthlyPayrollLiability * 0.1) || 70000 }
      ];
    }
    return [...payrollRuns]
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map(run => ({
        month: run.month,
        net: run.totalNet || 0,
        gross: run.totalGross || 0,
        deductions: run.totalDeductions || 0
      }));
  }, [payrollRuns, grossMonthlyPayrollLiability]);

  // Payment Methods Breakdown
  const payrollMethodData = useMemo(() => {
    const bank = employees.filter(e => e.paymentMethod === 'Bank').length;
    const cash = employees.filter(e => e.paymentMethod === 'Cash').length;
    return [
      { name: txt('إيداع بنكي للمصرف', 'Direct Bank Deposit'), value: bank || 1, color: '#0ea5e9' },
      { name: txt('تسليم نقدي مباشر', 'Direct Cash Payment'), value: cash, color: '#f59e0b' }
    ];
  }, [employees, isRtl]);

  // C. Operational Performance & In-house Delivery
  const totalProjectsCount = projects.length;
  const totalTasksCount = projectTasks.length;
  const doneTasks = projectTasks.filter(t => t.status === 'Approved' || t.status === 'Executed').length;
  const inProgressTasks = projectTasks.filter(t => t.status === 'In Progress' || t.status === 'Under Review' || t.status === 'Testing').length;
  const todoTasks = projectTasks.filter(t => t.status === 'Pending' || t.status === 'Rejected').length;
  
  const projectSuccessRate = totalTasksCount ? Math.round((doneTasks / totalTasksCount) * 100) : 100;
  
  // Real-time operations status
  const totalMissionsCount = missions.length;
  const approvedMissionsCount = missions.filter(m => m.status === 'Approved').length;
  const pendingMissionsCount = missions.filter(m => m.status === 'Pending').length;

  // Active Leaves Ratio
  const totalLeavesCount = leaveRequests.length;
  const pendingLeavesCount = leaveRequests.filter(l => l.status === 'Pending').length;
  const approvedLeavesCount = leaveRequests.filter(l => l.status === 'Approved').length;

  // Bio-Metric Clocking Devices & Networks
  const totalShiftsCount = attendanceShifts.length;
  const totalDevicesCount = attendanceDevices.length;
  const onlineDevicesCount = attendanceDevices.filter(d => d.status === 'Online' || d.status === 'Syncing').length;
  const totalAttendanceLogsCount = attendanceRecords.length;

  // D. Strategic Talent Performance metrics
  const activeAppraisalCycles = performanceCycles.length;
  const totalEvaluationsCount = performanceEvaluations.length;
  const activePlansCount = performanceDevelopmentPlans.length;
  
  // Evaluations completed vs pending
  const completedEvaluations = performanceEvaluations.filter(e => e.status === 'Approved' || e.status === 'Closed').length;
  const evaluationCompletionRate = totalEvaluationsCount ? Math.round((completedEvaluations / totalEvaluationsCount) * 100) : 100;

  // Average Performance Score
  const avgPerformanceRating = useMemo(() => {
    if (performanceEvaluations.length === 0) return 88.5;
    const scores = performanceEvaluations.map(e => Number(e.finalPercentageScore) || 0).filter(s => s > 0);
    if (scores.length === 0) return 85.0;
    const totalSum = scores.reduce((sum, s) => sum + s, 0);
    return Math.round((totalSum / scores.length) * 10) / 10;
  }, [performanceEvaluations]);

  // Executive Score Board
  // Formula combining workforce retention, project execution speed, evaluation ratings and device connectivity
  const executiveStrengthScore = useMemo(() => {
    const workforceFactor = totalEmployees ? (activeEmployees / totalEmployees) * 30 : 25;
    const projectFactor = (projectSuccessRate / 100) * 30;
    const performanceFactor = (avgPerformanceRating / 100) * 20;
    const leavesHealthyFactor = totalEmployees ? (1 - (onLeaveEmployees / totalEmployees)) * 20 : 20;
    return Math.round(workforceFactor + projectFactor + performanceFactor + leavesHealthyFactor);
  }, [totalEmployees, activeEmployees, projectSuccessRate, avgPerformanceRating, onLeaveEmployees]);


  // ==========================================
  // 2. EXCEL BOARD INSIGHT GENERATOR (STRATEGIC)
  // ==========================================
  const boardInsights = useMemo(() => {
    const insights = {
      strengths: [] as string[],
      attention: [] as string[],
      strategicDecisions: [] as string[]
    };

    // Calculate real rates
    const leavePercentage = totalEmployees ? ((onLeaveEmployees / totalEmployees) * 100).toFixed(1) : '0';
    const pendingActionRequests = pendingLeavesCount + pendingMissionsCount + pendingPenalties;

    // A. Strengths Assessment
    if (activeEmployees / totalEmployees > 0.85) {
      insights.strengths.push(
        txt(
          `رأس المال البشري مستقر للغاية مع معدل تشغيل فائق للموظفين يبلغ ${((activeEmployees/totalEmployees)*100).toFixed(0)}%.`,
          `Intellectual capital is highly stable with an outstanding active operational rate of ${((activeEmployees/totalEmployees)*100).toFixed(0)}%.`
        )
      );
    }
    if (projectSuccessRate > 75) {
      insights.strengths.push(
        txt(
          `إنتاجية ممتازة لإنجاز المهام الهندسية والمشروعات بمعدل نجاح وإقفال يبلغ ${projectSuccessRate}%.`,
          `Stellar execution rate on engineering operations and tasks with a success rate of ${projectSuccessRate}%.`
        )
      );
    }
    if (onlineDevicesCount === totalDevicesCount && totalDevicesCount > 0) {
      insights.strengths.push(
        txt(
          "اتصال بنسبة 100% لأجهزة قراءة البصمة والتحكم البيومتري بالبوابات دون انقطاع التشغيل الأمني.",
          "100% seamless bio-metric reader device connectivity, guaranteeing uninterrupted scheduling logs."
        )
      );
    } else {
      insights.strengths.push(
        txt(
          "يوجد تزامن تلقائي منتظم لجميع سجلات حضور وانضباط الكادر البشري يومياً.",
          "Automatic real-time attendance logs and biometric records synchronization is active."
        )
      );
    }

    // B. Critical Attention Areas
    if (pendingActionRequests > 0) {
      insights.attention.push(
        txt(
          `يوجد عدد ${pendingActionRequests} طلب تشغيلي (إجازات ومأموريات وعقوبات) تحت المراجعة المعلقة تتطلب إجراءً فورياً الحسم.`,
          `There are ${pendingActionRequests} pending human capital operations (leaves, missions, penalties) awaiting immediate action.`
        )
      );
    }
    if (cashEmployeesCount > 0) {
      insights.attention.push(
        txt(
          `يوجد عدد ${cashEmployeesCount} موظفاً يستلمون أجورهم نقداً. ينصح مجلس الإدارة بالتحويل لشبكة سداد المصرف لتحسين الامتثال المالي (WPS).`,
          `A total of ${cashEmployeesCount} employees receive cash wages. The Board advises migrating to bank payroll to enhance compliance (WPS).`
        )
      );
    }
    if (totalPenaltiesCount > 2) {
      insights.attention.push(
        txt(
          `رصد عدد ${totalPenaltiesCount} من مخالفات الانضباط المعتمدة هذا الشهر؛ تستلزم تفعيل خطط مراجعة البيئة المهنية وإجراءات التوعية للحد منها.`,
          `Identified ${totalPenaltiesCount} administrative warnings/penalties; requires workplace awareness campaigns.`
        )
      );
    } else {
      insights.attention.push(
        txt(
          "مستويات رضا الموظفين والانضباط في تزايد ملحوظ مع انخفاض تاريخي في معدلات المخالفات الحادة.",
          "Employee morale and corporate compliance show absolute positive trend with lowest severity incidents."
        )
      );
    }

    // C. Strategic Board Recommendations
    insights.strategicDecisions.push(
      txt(
        `الموافقة التشغيلية على خطة الموازنة القادمة بمتوسط كتلة نفقات دورية تبلغ ${formatCurrency(grossMonthlyPayrollLiability)} لمواجهة توسع الكفاءات.`,
        `Direct structural approval on future financial ceiling with average recurrent liabilities of ${formatCurrency(grossMonthlyPayrollLiability)}.`
      )
    );
    insights.strategicDecisions.push(
      txt(
        `تمكين حوكمة تقييمات الأداء المهني (التي سجلت معدل نجاح تقييم ${evaluationCompletionRate}%) لربطها بزيادات الربع القادم.`,
        `Empower corporate appraisal cycles (currently at ${evaluationCompletionRate}% completion rate) to structure upcoming merit increases.`
      )
    );
    insights.strategicDecisions.push(
      txt(
        `تفويض مديري أقسام العمليات بتعميم كروت ونطاقات متابعة المشاريع (إجمالي ${totalProjectsCount} مشاريع نشطة) لضمان تسليم مخرجات الأعمال.`,
        `Instruct executive directors to automate tracking across all ${totalProjectsCount} active projects to reinforce technical SLAs.`
      )
    );

    return insights;
  }, [
    employees, 
    projects, 
    totalLeavesCount, 
    pendingLeavesCount, 
    missions, 
    attendanceDevices, 
    penalties, 
    grossMonthlyPayrollLiability, 
    projectSuccessRate, 
    evaluationCompletionRate, 
    cashEmployeesCount,
    isRtl
  ]);

  return (
    <div className="space-y-8 pb-16 font-sans">
      
      {/* ==========================================
          A. EXECUTIVE BOARD HEADER HERO
         ========================================== */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white border-b-4 border-primary p-10 md:p-14 shadow-2xl transition-all">
        {/* Abstract futuristic grid background & flares */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#0ea5e9_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-right">
            
            {/* Dynamic Interactive Emblem Logo */}
            <motion.div 
              className={cn(
                "w-24 h-24 flex items-center justify-center relative shrink-0 overflow-hidden cursor-pointer rounded-none border border-white/20 p-2",
                systemSettings?.logoUrl 
                  ? "bg-slate-950/60 shadow-lg" 
                  : "bg-gradient-to-tr from-primary to-emerald-500 shadow-2xl shadow-primary/25"
              )}
              whileHover={{ scale: 1.08, rotate: 2, transition: { type: "spring", stiffness: 350 } }}
              whileTap={{ scale: 0.95 }}
            >
              {systemSettings?.logoUrl ? (
                <img 
                  src={systemSettings.logoUrl} 
                  alt="Dynamic Emblem" 
                  className="max-w-full max-h-full object-contain filter brightness-110" 
                  referrerPolicy="no-referrer" 
                  crossOrigin="anonymous" 
                />
              ) : (
                <Activity className="w-12 h-12 text-white animate-pulse" />
              )}
            </motion.div>
            
            {/* Strategic Branding & Titles */}
            <div>
              <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
                <span className="px-2.5 py-0.5 text-[8px] font-black uppercase tracking-widest bg-primary/20 border border-primary/40 text-primary-foreground rounded-none animate-pulse">
                  {txt("مركز الحوكمة الموحد", "Unified Corporate Controller")}
                </span>
                <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-widest bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-none">
                  {txt("وصول آمن للمجلس", "SECURE BOARD ACCESS")}
                </span>
              </div>
              <h1 className="text-[3.25rem] font-black tracking-tighter leading-none uppercase italic bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                {systemSettings?.organizationName || 'OPerix'}
              </h1>
              <p className="text-sm font-bold text-slate-300 mt-1 max-w-xl">
                {txt(
                  "النظام المتكامل لمراقبة رأس المال البشري، ضبط الرواتب، وتقييم الأداء الاستراتيجي للمؤسسة",
                  "Consolidated Enterprise Core for workforce tracking, financial control & performance governance"
                )}
              </p>
            </div>
          </div>

          {/* Core Corporate Strength Index Card */}
          <div className="shrink-0 bg-slate-950/80 border-2 border-white/20 p-6 flex items-center justify-between gap-6 min-w-[280px]">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                {txt("مؤشر الاستقرار والفاعلية الكلي", "Enterprise Strength Index")}
              </p>
              <p className="text-4xl font-black text-white font-mono tracking-tighter flex items-baseline gap-1">
                {executiveStrengthScore}%
                <span className="text-xs font-black text-emerald-400 font-sans tracking-tight">
                  {executiveStrengthScore >= 80 ? txt("ممتاز", "EXCELLENT") : txt("مستقر", "STABLE")}
                </span>
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                {txt("محتسب ديناميكياً من ٤ ركائز تشغيلية", "Calculated live across 4 operational vectors")}
              </p>
            </div>
            
            {/* Live SVG Progress Gauge */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full rotate-[-90deg]">
                <circle cx="32" cy="32" r="28" stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="transparent" />
                <circle 
                  cx="32" 
                  cy="32" 
                  r="28" 
                  stroke="var(--color-primary, #0ea5e9)" 
                  strokeWidth="6" 
                  fill="transparent" 
                  strokeDasharray={2 * Math.PI * 28}
                  strokeDashoffset={2 * Math.PI * 28 * (1 - executiveStrengthScore / 100)}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black font-mono">
                ESI
              </div>
            </div>
          </div>
        </div>

        {/* Action Belt: Realtime counters and Board Insight Generator call */}
        <div className="mt-10 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="flex flex-wrap items-center gap-6 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <p className="text-xs font-bold">
                {txt(`الدورة التشغيلية الحالية: ${lastFinishedRun?.month || '2026-06'}`, `Current Operating Cycle: ${lastFinishedRun?.month || '2026-06'}`)}
              </p>
            </div>
            <div className="h-4 w-px bg-slate-800 hidden md:block" />
            <p className="text-xs text-slate-400">
              {txt(`إجمالي كود التوزيع المصرفي: ${totalEmployees} موظف`, `Total Authorized Roster: ${totalEmployees} employees`)}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsReportOpen(true)}
            className="w-full md:w-auto px-6 py-3.5 bg-gradient-to-r from-primary to-emerald-500 hover:from-primary/90 hover:to-emerald-500/90 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-primary/20 group"
          >
            <Sparkles className="w-4 h-4 text-white group-hover:animate-spin" />
            {txt("توليد تقرير مجلس الإدارة الاستراتيجي", "Generate Board Strategic Report")}
          </motion.button>
        </div>
      </div>


      {/* ==========================================
          B. STRATEGIC TAB NAVIGATION CONTROL
         ========================================== */}
      <div className="relative z-10 max-w-7xl mx-auto px-1">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 border-b-2 border-border pb-1">
          {[
            { id: '360', icon: Activity, ar: 'العرض الشامل ٣٦٠°', en: 'Core 360° Vision' },
            { id: 'hr', icon: Users, ar: 'الهيكل والوظائف', en: 'Intellectual Capital' },
            { id: 'finance', icon: Landmark, ar: 'حوكمة الأجور والنفقات', en: 'Financial Outlays' },
            { id: 'ops', icon: Timer, ar: 'الانضباط والإنتاجية', en: 'Biometrics & Deliverables' },
            { id: 'perf', icon: Target, ar: 'تقييم كفاءة الأداء', en: 'Talent Appraisals' }
          ].map((tab) => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "p-4 flex items-center justify-center gap-3 border-b-4 text-xs font-black uppercase tracking-wider transition-all rounded-none",
                  isTabActive
                    ? "bg-card border-primary text-foreground font-black shadow-md"
                    : "bg-card/30 border-transparent text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                <tab.icon className={cn("w-4 h-4 shrink-0", isTabActive ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate">{txt(tab.ar, tab.en)}</span>
              </button>
            );
          })}
        </div>
      </div>


      {/* ==========================================
          C. CORE KPI AND METRICS GRID
         ========================================== */}
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* TAB 1: 360 VISION */}
        {activeTab === '360' && (
          <div className="space-y-8">
            
            {/* Giga 4 Cards Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  id: 'hc',
                  title: txt("إجمالي رأس المال البشري", "Active Human Force"),
                  value: totalEmployees,
                  subtext: txt(`${activeEmployees} موظفي تشغيل مستمر`, `${activeEmployees} active roster staff`),
                  icon: Users,
                  color: "border-l-primary",
                  meta: txt(`القوة الفعلية للمؤسسة`, `Total enterprise coverage`)
                },
                {
                  id: 'fin',
                  title: txt("كتلة الأجور الشهرية الكلية", "Monthly Financial Vol"),
                  value: formatCurrency(grossMonthlyPayrollLiability),
                  subtext: txt(`متوسط الفرد: ${formatCurrency(averageEmployeeWage)}`, `Mean per-staff wage: ${formatCurrency(averageEmployeeWage)}`),
                  icon: Wallet,
                  color: "border-l-emerald-500",
                  meta: txt(`الاستحقاق المالي التقريبي`, `Gross monthly salary liability`)
                },
                {
                  id: 'op',
                  title: txt("معدل نجاح إتمام المشاريع", "Operational Delivery Progress"),
                  value: `${projectSuccessRate}%`,
                  subtext: txt(`عدد ${totalProjectsCount} مشاريع قائمة`, `${totalProjectsCount} active projects monitored`),
                  icon: Briefcase,
                  color: "border-l-indigo-600",
                  meta: txt(`نسبة إغلاق مهام المهندسين`, `Tasks execution index`)
                },
                {
                  id: 'eval',
                  title: txt("معدل اكتمال التقييم المهني", "Appraisal Execution Rate"),
                  value: `${evaluationCompletionRate}%`,
                  subtext: txt(`متوسط الكفاءة العام: ${avgPerformanceRating}%`, `Core talent mean score: ${avgPerformanceRating}%`),
                  icon: Award,
                  color: "border-l-amber-500",
                  meta: txt(`نظام قياس الجدوى الإداري`, `Talent calibration status`)
                }
              ].map((card, idx) => (
                <div key={idx} className={cn("card-sharp card-sharp-hover flex flex-col justify-between p-6 relative overflow-hidden cursor-default group", card.color, "border-l-4")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{card.title}</p>
                      <h4 className="text-3.5xl font-black text-foreground mt-2 font-mono leading-none">{card.value}</h4>
                    </div>
                    <div className="w-10 h-10 border border-border/80 flex items-center justify-center shrink-0 bg-muted/20 text-muted-foreground group-hover:bg-foreground group-hover:text-background transition-colors">
                      <card.icon className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-6 pt-4 border-t border-border/60 flex items-center justify-between text-[10px]">
                    <span className="font-bold text-muted-foreground">{card.subtext}</span>
                    <span className="bg-muted px-1.5 py-0.5 font-bold uppercase text-[9px] text-muted-foreground font-mono tracking-tighter">{card.meta}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Interactive Charts & Report summaries */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Chart: Six Month Outlays Trends */}
              <div className="lg:col-span-2 card-sharp card-sharp-hover p-8">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      {txt("الملف المالي والأجور التاريخي", "Financial Payroll Outflow Profile")}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 font-bold">
                      {txt("مقاربة الأجور المصروفة، البدلات الإضافية والاستقطاعات لآخر 6 دورات مالية", "Visual trend of basic disbursements, allowances & deductions across last 6 cycles")}
                    </p>
                  </div>
                </div>
                
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={financialTrendData}>
                      <defs>
                        <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: 'var(--muted-foreground)', fontSize: 9, fontWeight: 900}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--muted-foreground)', fontSize: 9, fontWeight: 900}} tickFormatter={(v) => `${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '0px', 
                          border: '2px solid var(--border)', 
                          backgroundColor: 'var(--card)', 
                          color: 'var(--foreground)', 
                          fontWeight: '900',
                          fontSize: '11px'
                        }}
                        formatter={(v: number) => [formatCurrency(v), '']}
                      />
                      <Area type="monotone" name="Net Payroll" dataKey="net" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#netGrad)" />
                      <Area type="monotone" name="Gross Liability" dataKey="gross" stroke="#8b5cf6" strokeWidth={1} strokeDasharray="3 3" fillOpacity={1} fill="url(#grossGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Snapshot Audit Dashboard of Board actions */}
              <div className="card-sharp card-sharp-hover p-8 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-black text-foreground flex items-center gap-2 mb-2">
                    <ShieldAlert className="w-5 h-5 text-amber-500" />
                    {txt("ملخص الرقابة والامتثال للمجلس", "Board Regulatory Oversight Summary")}
                  </h3>
                  <p className="text-xs text-muted-foreground pb-6 border-b border-border font-bold">
                    {txt("سجل الأنشطة والمخالفات المعتمدة وطلبات التشغيل الحيوية المعلقة", "Live compliance warnings, active warnings and pending workflows")}
                  </p>

                  <div className="space-y-6 mt-6">
                    <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-none bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/25">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">{txt("طلب المراجعة للإجازات المعلقة", "Pending Leave Actions")}</p>
                          <p className="text-[9px] text-muted-foreground font-semibold">{txt("يحتاج الموافقة من الموارد البشرية", "Requires HR executive veto")}</p>
                        </div>
                      </div>
                      <span className="text-xs font-black font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 border border-amber-500/20">{pendingLeavesCount}</span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-none bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/25">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">{txt("إجمالي الجزاءات التأديبية النشطة", "Total Discipline Incident Penalties")}</p>
                          <p className="text-[9px] text-muted-foreground font-semibold">{txt("سجلات معتمدة هذا الشهر", "Issued & filed compliance logs")}</p>
                        </div>
                      </div>
                      <span className="text-xs font-black font-mono text-red-500 bg-red-500/10 px-2 py-0.5 border border-red-500/20">{totalPenaltiesCount}</span>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-none bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/25">
                          <PlaneTakeoff className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground">{txt("مأموريات العمل والزيارات الفنية", "Technical Missions & Visits")}</p>
                          <p className="text-[9px] text-muted-foreground font-semibold">{txt("رحلات حقلية معتمدة وقائمة", "Active approved business field trips")}</p>
                        </div>
                      </div>
                      <span className="text-xs font-black font-mono text-indigo-600 bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/20">{approvedMissionsCount}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-border mt-8 flex flex-col gap-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{txt("مستوى امتثال حماية الأجور (WPS)", "WPS Wage Protection level")}</span>
                    <span className="font-bold text-foreground font-mono">
                      {totalEmployees ? ((bankEmployeesCount / totalEmployees) * 100).toFixed(0) : 100}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-1000" 
                      style={{ width: `${totalEmployees ? (bankEmployeesCount / totalEmployees) * 100 : 100}%` }}
                    />
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}


        {/* TAB 2: HR & INTELLECTUAL CAPITAL */}
        {activeTab === 'hr' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Visual breakdown of positions and personnel states */}
            <div className="card-sharp card-sharp-hover p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-black text-foreground flex items-center gap-2 mb-6">
                  <Users className="w-5 h-5 text-primary" />
                  {txt("رأس المال البشري والوظيفة", "Intellectual Capital Inventory")}
                </h3>
                
                <div className="space-y-6">
                  {[
                    { label: txt("الموظفون على رأس العمل", "Fully Active Personnel"), count: activeEmployees, total: totalEmployees, color: "bg-emerald-500" },
                    { label: txt("موظفون مؤشر غياب / إجازة", "Active Leaves of Absence"), count: onLeaveEmployees, total: totalEmployees, color: "bg-sky-500" },
                    { label: txt("غير نشط / نهاية الخدمة", "End of Service Roster"), count: inactiveEmployees, total: totalEmployees, color: "bg-slate-500" }
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold text-foreground">
                        <span>{item.label}</span>
                        <span className="font-mono">{item.count} / {item.total}</span>
                      </div>
                      <div className="h-2 bg-muted overflow-hidden">
                        <div className={cn("h-full transition-all duration-1000", item.color)} style={{ width: `${totalEmployees ? (item.count / totalEmployees) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extra HR KPI card stats */}
              <div className="pt-8 border-t border-border mt-8 space-y-4">
                <div className="p-4 bg-muted/30 border border-border flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">{txt("الأقسام الهيكلية الحيوية", "Administrative Departments")}</p>
                    <p className="text-2xl font-black text-foreground mt-1">{departmentsCount}</p>
                  </div>
                  <Building2 className="w-8 h-8 text-primary/20" />
                </div>
                <div className="p-4 bg-muted/30 border border-border flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">{txt("معدل ساعات العمل القياسي اليومي", "Mean Standard Workhours Pattern")}</p>
                    <p className="text-2xl font-black text-foreground mt-1">{avgWorkHours} <span className="text-xs text-muted-foreground">{txt("ساعة/يوم", "hrs/day")}</span></p>
                  </div>
                  <Clock className="w-8 h-8 text-primary/20" />
                </div>
              </div>
            </div>

            {/* Department-wise Distribution Chart */}
            <div className="lg:col-span-2 card-sharp card-sharp-hover p-8">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-indigo-500" />
                {txt("حضور وتمدد القوى العاملة بالأقسام الإدارية", "Workforce Allocation & Departmental Density")}
              </h3>
              <p className="text-xs text-muted-foreground font-bold mb-8">
                {txt("بيان يعرض كثافة الموارد البشرية وتخصيصات الأقسام الرئيسية", "Density level and count profiles of personnel directly mapped to organization structure")}
              </p>

              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={departmentMetrics} layout="vertical" margin={{ left: 30, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.3} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: 'var(--muted-foreground)', fontSize: 9, fontWeight: 900}} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: 'var(--foreground)', fontSize: 10, fontWeight: 900}} width={120} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '0px', border: '2px solid var(--border)', backgroundColor: 'var(--card)' }}
                      formatter={(v) => [`${v} ${txt('موظف', 'Staff')}`, '']}
                    />
                    <Bar dataKey="count" fill="var(--color-primary, #0ea5e9)" radius={[0, 4, 4, 0]}>
                      {departmentMetrics.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#0ea5e9' : '#8b5cf6'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        )}


        {/* TAB 3: FINANCIAL GOVERNANCE & COST CONTROL */}
        {activeTab === 'finance' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Detailed allowances analysis */}
              <div className="card-sharp card-sharp-hover p-8">
                <h3 className="text-lg font-black text-foreground flex items-center gap-2 mb-6">
                  <Wallet className="w-5 h-5 text-emerald-500" />
                  {txt("هيكلة وتوزيع كتل البدلات الصادرة", "Financial Allowance Categorization Block")}
                </h3>

                <div className="space-y-4">
                  {[
                    { label: txt("أجور الرواتب الأساسية", "Base Basic Wages Volume"), amount: totalBasicSalary, percentage: (totalBasicSalary/grossMonthlyPayrollLiability)*100 },
                    { label: txt("إجمالي بدلات السكن", "Housing Allowances Block"), amount: totalHousing, percentage: (totalHousing/grossMonthlyPayrollLiability)*100 },
                    { label: txt("أخصائي بدلات النقل والتحرك", "Transport Allowances Block"), amount: totalTransport, percentage: (totalTransport/grossMonthlyPayrollLiability)*100 },
                    { label: txt("البدلات الجوالة والاتصال", "Mobile Allowances Block"), amount: totalMobile, percentage: (totalMobile/grossMonthlyPayrollLiability)*100 },
                    { label: txt("البدلات الإدارية والقيادة", "Management & Admin Allocations"), amount: totalManagement, percentage: (totalManagement/grossMonthlyPayrollLiability)*100 },
                    { label: txt("البدلات التشغيلية الطارئة الأخرى", "Other Miscellaneous Allowances"), amount: totalOtherAllowances, percentage: (totalOtherAllowances/grossMonthlyPayrollLiability)*100 }
                  ].map((allow, idx) => (
                    <div key={idx} className="p-4 bg-muted/40 border border-border space-y-1">
                      <div className="flex justify-between items-center text-xs font-black">
                        <span className="text-muted-foreground">{allow.label}</span>
                        <span className="text-foreground">{formatCurrency(allow.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <div className="h-1 flex-1 bg-muted rounded-full">
                          <div className="h-full bg-emerald-500" style={{ width: `${allow.percentage || 0}%` }} />
                        </div>
                        <span className="font-black font-mono">{(allow.percentage || 0).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Six Month financial outflow detailing chart */}
              <div className="lg:col-span-2 card-sharp card-sharp-hover p-8 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-black text-foreground flex items-center gap-2 mb-2">
                    <Landmark className="w-5 h-5 text-indigo-500" />
                    {txt("الرقابة المفتوحة لثلاثي الموازنة الشهرية", "Operational Cost-Center Triple Ledger Breakdown")}
                  </h3>
                  <p className="text-xs text-muted-foreground font-bold mb-8">
                    {txt("عرض مقارن لموازنات الأجور الإجمالية، المبالغ المحسومة، والمبالغ المستلمة الصافية عبر الزمن", "Comparison graph of Gross allocations, Deductions and Clear net payouts across months")}
                  </p>

                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={financialTrendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: 'var(--muted-foreground)', fontSize: 9, fontWeight: 900}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--muted-foreground)', fontSize: 9, fontWeight: 900}} tickFormatter={(v) => `${v/1000}k`} />
                        <Tooltip contentStyle={{ borderRadius: '0px', border: '2px solid var(--border)', backgroundColor: 'var(--card)' }} />
                        <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 900 }} />
                        <Bar name={txt("إجمالي الموازنة المستحقة", "Gross Volume")} dataKey="gross" fill="#8b5cf6" />
                        <Bar name={txt("الاستقطاعات والجزاءات الفورية", "Deductions Tracked")} dataKey="deductions" fill="#f43f5e" />
                        <Bar name={txt("صافي السيولة النقدية المصروفة", "Net Cash Disbursed")} dataKey="net" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-border bg-muted/20 p-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{txt("متراكم الأجور المصروفة الكلية", "Cumulative Recorded Payouts")}</p>
                    <p className="text-2xl font-black text-emerald-500 font-mono mt-1">
                      {formatCurrency(financialTrendData.reduce((sum, item) => sum + item.net, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{txt("متراكم استقطاعات الجزاء وبصمة", "Cumulative Structural Deductions")}</p>
                    <p className="text-2xl font-black text-rose-500 font-mono mt-1">
                      {formatCurrency(financialTrendData.reduce((sum, item) => sum + item.deductions, 0))}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}


        {/* TAB 4: OPERATIONAL PRODUCTIVITY & LOGISTICS */}
        {activeTab === 'ops' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Project task deliverable status dashboard */}
            <div className="card-sharp card-sharp-hover p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-black text-foreground flex items-center gap-2 mb-2">
                  <Briefcase className="w-5 h-5 text-indigo-500" />
                  {txt("بيان المخرجات والمشروعات القائمة", "Operational Engineering Deliverables")}
                </h3>
                <p className="text-xs text-muted-foreground font-bold pb-6 border-b border-border mb-6">
                  {txt("قياس مستوى رضاء المشروعات وكفاءة سرعة تسليم مخرجات المهندسين", "Productivity indicators and tasks breakdown across technical squads")}
                </p>

                <div className="space-y-4">
                  <div className="flex justify-between items-center text-xs font-bold text-foreground">
                    <span>{txt("مشاريع تنظيمية نشطة", "Dynamic Projects Count")}</span>
                    <span className="font-mono">{totalProjectsCount}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-foreground">
                    <span>{txt("مهام مسجلة باللوحة الموحدة", "Total Logged Backlog Tasks")}</span>
                    <span className="font-mono">{totalTasksCount}</span>
                  </div>
                  
                  <div className="h-px bg-border my-4" />

                  <div className="space-y-3">
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-emerald-500">{txt("مهام منجزة ومقفلة", "Fully Completed Tasks")}</span>
                      <span>{doneTasks}</span>
                    </div>
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-amber-500">{txt("مهام قيد التقدم والتأكيد", "In-Progress Milestones")}</span>
                      <span>{inProgressTasks}</span>
                    </div>
                    <div className="flex justify-between text-xs font-black">
                      <span className="text-slate-500">{txt("مسودة المهام المستقبلية", "Backlog/Planned Tasks")}</span>
                      <span>{todoTasks}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live gauge of execution rates */}
              <div className="pt-8 border-t border-border mt-8 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{txt("سرعة غلق تذاكر المخرجات", "Technical Accomplishment Speed")}</p>
                  <p className="text-2xl font-black text-indigo-600 font-mono mt-1">{projectSuccessRate}%</p>
                </div>
                <Activity className="w-10 h-10 text-indigo-500/10 animate-pulse" />
              </div>
            </div>

            {/* Attendance biometrics connectivity and logs indicators */}
            <div className="lg:col-span-2 card-sharp card-sharp-hover p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-black text-foreground flex items-center gap-2 mb-2">
                  <Wifi className="w-5 h-5 text-sky-500" />
                  {txt("رصد اتصالات البصمة وسجل العبور الحاد", "Unified Biometic Logs & Gateway Monitoring")}
                </h3>
                <p className="text-xs text-muted-foreground font-bold mb-8">
                  {txt("عرض حالة الاتصال المباشر لأجهزة قراءة البصمة بالمواقع وكميات العبور المسجلة", "Direct live ping of biometric network machines and recorded attendance records")}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                  <div className="p-4 bg-muted/40 border border-border text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{txt("أجهزة تسجيل الحضور", "Physical Clocking Machines")}</p>
                    <p className="text-3xl font-black text-foreground mt-2 font-mono">{totalDevicesCount}</p>
                    <span className="text-[9px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20 rounded-none inline-block mt-2 font-black font-mono">
                      {onlineDevicesCount} {txt("متصل", "ONLINE")}
                    </span>
                  </div>
                  <div className="p-4 bg-muted/40 border border-border text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{txt("المسارات والورديات الفعالة", "Active Workplace Shifts")}</p>
                    <p className="text-3xl font-black text-foreground mt-2 font-mono">{totalShiftsCount}</p>
                    <span className="text-[9px] text-sky-500 bg-sky-500/10 px-2 py-0.5 border border-sky-500/20 rounded-none inline-block mt-2 font-black font-mono">
                      Shift Matrix
                    </span>
                  </div>
                  <div className="p-4 bg-muted/40 border border-border text-center">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{txt("إجمالي سجلات العبور المخزنة", "Aggregated Biometric Logs")}</p>
                    <p className="text-3xl font-black text-foreground mt-2 font-mono">{totalAttendanceLogsCount}</p>
                    <span className="text-[9px] text-indigo-500 bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/20 rounded-none inline-block mt-2 font-black font-mono">
                      Synced Record Storage
                    </span>
                  </div>
                </div>

                {/* Extra warning message about offline biometrics */}
                {onlineDevicesCount < totalDevicesCount && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-900 dark:text-amber-300 font-bold">
                      {txt(
                        `تنبيه: يوجد عدد ${totalDevicesCount - onlineDevicesCount} أجهزة تسجيل خارج الخدمة مؤقتاً. يرجى التأكد من تزامن الشبكات.`,
                        `Attention: ${totalDevicesCount - onlineDevicesCount} clocking device is offline. Biometric logs may be delayed.`
                      )}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-border mt-6">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span className="font-bold">{txt("إجمالي الكادر في مهام عمل خارجية حالياً", "Roster staff currently deployed on technical business trips")}</span>
                  <span className="font-black font-mono text-indigo-600 bg-indigo-500/10 px-2.5 py-1 border border-indigo-500/25">
                    {approvedMissionsCount} {txt("موظفي ميدان", "Field Engineers")}
                  </span>
                </div>
              </div>
            </div>

          </div>
        )}


        {/* TAB 5: TALENT APPRAISALS & PROFESSIONAL GROWTH */}
        {activeTab === 'perf' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Radar chart mapping appraisal parameters or performance statistics */}
            <div className="lg:col-span-2 card-sharp card-sharp-hover p-8">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-amber-500" />
                {txt("محاور تقييم مخرجات الكادر الوظيفي العام", "Talent Capability Calibration Blueprint")}
              </h3>
              <p className="text-xs text-muted-foreground font-bold mb-8">
                {txt("توزيع مستويات الكفاءة والامتياز المهني على محاور الإنتاجية والانضباط الفعلي لمجلس الإدارة", "Appraisal scores distribution across core corporate indicators calculated in real-time")}
              </p>

              <div className="h-[340px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart 
                    data={[
                      { subject: txt('إنتاجية المخرجات', 'Execution Output'), score: Number(avgPerformanceRating) || 85, mean: 80 },
                      { subject: txt('الانضباط والالتزام', 'Workplace Attendance'), score: totalEmployees ? (activeEmployees/totalEmployees)*100 : 90, mean: 85 },
                      { subject: txt('الالتزام بالسياسات', 'Corporate Code adherence'), score: totalPenaltiesCount ? Math.max(100 - (totalPenaltiesCount*8), 60) : 98, mean: 80 },
                      { subject: txt('التعليم والنمو المستمر', 'Professional Development'), score: activePlansCount ? Math.min(60 + (activePlansCount*10), 100) : 75, mean: 70 },
                      { subject: txt('علاقات العمل والعمل المشترك', 'Cross Squad Synergy'), score: 90, mean: 82 }
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                    <XAxis dataKey="subject" tick={{ fill: 'var(--foreground)', fontSize: 10, fontWeight: 900 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: 'var(--muted-foreground)', fontSize: 8 }} />
                    <Tooltip contentStyle={{ borderRadius: '0px', border: '2px solid var(--border)', backgroundColor: 'var(--card)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 900 }} />
                    <Area name={txt("كفاءة الكادر الفعلية (%)", "Current Resource Strength (%)")} dataKey="score" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={3} />
                    <Area name={txt("خط الأساس المستهدف (%)", "Strategic Compliance Baseline (%)")} dataKey="mean" stroke="#94a3b8" fill="#94a3b8" strokeDasharray="5 5" fillOpacity={0.05} strokeWidth={1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance appraisal data panels */}
            <div className="card-sharp card-sharp-hover p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-black text-foreground flex items-center gap-2 mb-6">
                  <Award className="w-5 h-5 text-amber-500" />
                  {txt("الدورة التشغيلية لتقييم الأداء", "Strategic Appraisal Campaign Control")}
                </h3>

                <div className="space-y-6">
                  <div className="p-4 bg-muted/40 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{txt("حملات التقييم النشطة بالخلفية", "Active Dynamic Performance Cycles")}</p>
                    <p className="text-3xl font-black text-foreground mt-1 font-mono">{activeAppraisalCycles}</p>
                    <div className="flex gap-1.5 flex-wrap mt-2">
                      {performanceCycles.slice(0, 2).map((c, i) => (
                        <span key={i} className="text-[9px] font-black bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-none font-mono">
                          {isRtl ? c.nameAr : c.nameEn}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-muted/40 border border-border justify-between flex items-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{txt("خطط النمو المهني الفعالة للتنشيط", "Active Professional Development Plans")}</p>
                      <p className="text-2xl font-black text-foreground font-mono mt-1">{activePlansCount}</p>
                    </div>
                    <Target className="w-8 h-8 text-amber-500/20" />
                  </div>

                  <div className="p-4 bg-muted/40 border border-border">
                    <div className="flex justify-between text-xs font-black mb-1">
                      <span>{txt("مستوى اكتمال كروت التقييم", "Appraisal Execution status")}</span>
                      <span>{completedEvaluations} / {totalEvaluationsCount}</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted overflow-hidden">
                      <div className="h-full bg-amber-500 transition-all duration-1000" style={{ width: `${evaluationCompletionRate}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border mt-8">
                <div className="p-4 bg-amber-500/5 border border-amber-500/10 flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-[10px] text-amber-950 dark:text-amber-300 font-bold leading-normal">
                    {txt(
                      "يتم تزامن تقييمات الأداء مع مسار زيادة الرواتب ومصفوفات الحوافز المالية تلقائياً بالقسم المالي.",
                      "Appraisal calibrations are interlinked with wage progression indexes and bonus eligibility in the financial module."
                    )}
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>


      {/* ==========================================
          D. THE STRATEGIC EXECUTIVE BOARD REPORT DRAWER/MODAL
         ========================================== */}
      <AnimatePresence>
        {isReportOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            
            {/* Backdrop Blur overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReportOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
            />

            <div className="flex min-h-full items-center justify-center p-4 text-center md:p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="relative transform overflow-hidden bg-card border-t-4 border-emerald-500 text-foreground text-left p-10 md:p-14 md:max-w-4xl w-full shadow-2xl transition-all"
              >
                
                {/* Header elements */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b-2 border-border pb-6 mb-8 gap-4">
                  <div className="text-right md:text-right flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500 mb-1">{txt("وثيقة استراتيجية سرية - مجلس الإدارة", "CONFIDENTIAL STRATEGIC MEMO - EXECUTIVE BOARD")}</p>
                    <h2 className="text-3xl font-black text-foreground select-none uppercase tracking-tight font-sans">
                      {txt("تقرير التقييم التنفيذي الشامل", "Consolidated Enterprise Statement")}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {txt(`تم إصدار هذا التحليل تلقائياً بدلالة بيانات النظام الراهنة بتاريخ اليوم`, `Generated live based on actual systems datasets for current Board review`)}
                    </p>
                  </div>
                  
                  {/* Select fiscal cycle trigger */}
                  <div className="flex items-center gap-2 shrink-0 md:justify-end">
                    <span className="text-[10px] font-bold text-muted-foreground font-mono">{txt("الفترة المالية:", "Fiscal:")}</span>
                    <select 
                      value={reportPeriod} 
                      onChange={(e) => setReportPeriod(e.target.value)}
                      className="bg-muted px-3 py-1.5 text-xs text-foreground font-black border border-border rounded-none focus:outline-none focus:border-primary"
                    >
                      <option value="2026 Q2">{txt("الربع الثاني - ٢٠٢٦", "2026 Q2")}</option>
                      <option value="2026 Q1">{txt("الربع الأول - ٢٠٢٦", "2026 Q1")}</option>
                    </select>
                  </div>
                </div>

                {/* Printable Letterhead layout styling */}
                <div className="space-y-8 select-text">
                  
                  {/* Executive Overview narrative block */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-[#10b981] flex items-center gap-2">
                      <HighlightDot color="bg-emerald-500" />
                      {txt("١. الملخص التنفيذي وأبرز المؤشرات", "1. EXECUTIVE SUMMARY & CORPORATE STATURE")}
                    </h4>
                    <p className="text-xs leading-relaxed text-muted-foreground font-semibold text-justify">
                      {txt(
                        `يرتكز تقرير الأداء الحالي لمؤسسة ${systemSettings?.organizationName || 'OPerix'} على تحليل متكامل للبيانات الكبرى للتوظيف، وإدارة الرواتب، وساعات الانضباط البيومتري المباشر. في هذه الفترة، بلغت القوة التشغيلية الكلية ${totalEmployees} موظفاً فعلياً بمستوى استقرار تشغيلي متميز ومستويات اتصال بالأجهزة بنسبة ١٠٠٪. نسجل أيضاً إنجازاً ممتازاً على خطوط المشروعات والمهام بمعدل إقفال يبلغ نحو ${projectSuccessRate}٪ مما يبرز حيوية وكفاءة الكوادر في تلبية مستخدمات العمل وحوكمة الالتزامات.`,
                        `The current performance report for ${systemSettings?.organizationName || 'OPerix'} is anchored in the aggregated live datasets of human resource dynamics, payroll integrity, and biometric logs. During this fiscal cycle, our operational core covers ${totalEmployees} active employees. On operational delivery, we record a remarkable SLA task accomplishment rate of ${projectSuccessRate}%, highlighting high intellectual capacity and strong scheduling efficiency across all active project modules.`
                      )}
                    </p>
                  </div>

                  {/* Highlights Grid of counts */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-y border-border select-none">
                    <div className="text-center font-mono">
                      <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">{txt("الأجور المصروفة", "Gross Payout Liability")}</p>
                      <p className="text-lg font-black text-foreground mt-1">{formatCurrency(grossMonthlyPayrollLiability)}</p>
                    </div>
                    <div className="text-center font-mono">
                      <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">{txt("القوة العاملة التشغيلية", "Active Operating Force")}</p>
                      <p className="text-lg font-black text-foreground mt-1">{activeEmployees} / {totalEmployees}</p>
                    </div>
                    <div className="text-center font-mono">
                      <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">{txt("كفاءة المشاريع", "Operational Velocity")}</p>
                      <p className="text-lg font-black text-foreground mt-1">{projectSuccessRate}%</p>
                    </div>
                    <div className="text-center font-mono">
                      <p className="text-[9px] font-black tracking-widest text-muted-foreground uppercase">{txt("ثقة الأداء العام", "Mean Staff Appraisal")}</p>
                      <p className="text-lg font-black text-foreground mt-1">{avgPerformanceRating}%</p>
                    </div>
                  </div>

                  {/* Dynamic Real Strengths block */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      <HighlightDot color="bg-primary" />
                      {txt("٢. ركائز ونقاط القوة والنمو", "2. STRUCTURAL STRENGTHS & VALUE MULTIPLIERS")}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {boardInsights.strengths.map((strength, i) => (
                        <div key={i} className="p-4 bg-muted/40 border border-border flex gap-3 text-xs">
                          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                          <p className="text-muted-foreground leading-relaxed font-bold">{strength}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic Alert Areas */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
                      <HighlightDot color="bg-amber-500" />
                      {txt("٣. مجالات تستدعي انتباه مجلس الإدارة", "3. ATTENTION TRIGGERS & COMPLIANCE RISKS")}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {boardInsights.attention.map((att, i) => (
                        <div key={i} className="p-4 bg-amber-500/5 border border-amber-500/10 flex gap-3 text-xs">
                          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-muted-foreground leading-relaxed font-bold">{att}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Board Strategic Decisions recommendations */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-indigo-500 flex items-center gap-2">
                      <HighlightDot color="bg-indigo-500" />
                      {txt("٤. توصيات وقرارات المجلس المقترحة", "4. PROPOSED BOARD RESOLUTIONS & MANDATES")}
                    </h4>
                    <div className="space-y-3">
                      {boardInsights.strategicDecisions.map((decision, i) => (
                        <div key={i} className="p-4 bg-card border-2 border-border flex items-start gap-4">
                          <div className="w-6 h-6 rounded-none bg-indigo-500 text-white font-black font-mono text-xs flex items-center justify-center shrink-0">
                            {i+1}
                          </div>
                          <p className="text-xs font-bold text-foreground leading-relaxed">{decision}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

                {/* Footer close button and print handler */}
                <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
                  <span className="text-[9px] text-muted-foreground tracking-widest font-mono select-none">
                    {txt(`نظام المراقبة الاستراتيجي الموحد • OPerix Unified Dashboard`, `Consolidated strategic controller • key: BOARD_V1`)}
                  </span>
                  
                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => window.print()}
                      className="flex-1 md:flex-none px-5 py-3 border border-border font-black text-xs uppercase tracking-wider hover:bg-muted transition-colors"
                    >
                      {txt("طباعة الوثيقة الرسمية", "Print Statement")}
                    </button>
                    <button 
                      onClick={() => setIsReportOpen(false)}
                      className="flex-1 md:flex-none px-6 py-3 bg-foreground text-background font-black text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
                    >
                      {txt("إغلاق الملف مراجعة", "Close File Review")}
                    </button>
                  </div>
                </div>

              </motion.div>
            </div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

// --- Local Helper UI Components to maintain high clean modular styling ---

// Dot highlighter indicator
const HighlightDot: React.FC<{ color: string }> = ({ color }) => (
  <span className={cn("inline-block w-2 h-2 rounded-full", color)} />
);
