export type UserRole = 'HR' | 'Finance' | 'Admin' | 'Viewer' | 'Operations';

export interface ScreenActionConfig {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  export: boolean;
}

export interface PermissionConfig {
  screens?: {
    [screenId: string]: ScreenActionConfig;
  };
  departments?: string[]; // IDs of allowed departments, or empty for all.
}

export interface Allowance {
  id?: string;
  type: string;
  amount: number;
}

export interface AllowanceType {
  id: string;
  name: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'Active' | 'Inactive';
  photoUrl?: string;
  employeeId?: string;
  createdAt: string;
  permissions?: PermissionConfig;
}

export type AttendanceType = 'In' | 'Out';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  timestamp: string;
  type: AttendanceType;
  deviceId?: string;
  deviceName?: string;
  manual?: boolean;
  note?: string;
}

export interface AttendanceDevice {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  lastSync?: string;
  status: 'Online' | 'Offline' | 'Syncing';
}

export interface AttendanceShift {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  graceMinutes: number;
  workDays: number[]; // 0 (Sun) to 6 (Sat)
}

export interface AbsenceType {
  id: string;
  name: string;
  deductionRatio: number; // e.g., 1 for full day, 0.5 for half day
}

export interface AbsenceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  absenceTypeId: string;
  note?: string;
}

export interface MissionAllowance {
  id: string;
  name: string;
  amount: number;
  type: 'Daily' | 'Once';
}

export interface MissionType {
  id: string;
  name: string;
  allowanceAmount?: number;
  allowances: MissionAllowance[];
  projectIds?: string[];
}

export interface MissionEvaluation {
  timeAdherence: number;       // الالتزام بالوقت والجدول 40%
  qualityResults: number;      // جودة النتائج والمخرجات 30%
  conductCooperation: number;  // الالتزام والتعاون والسلوك المهني 30%
  finalScore: number;          // الدرجة الموزونة النهائية من 100
  ratingGrade?: 'ممتاز' | 'جيد جداً' | 'جيد' | 'يحتاج تحسين';
  notes?: string;              // ملاحظات وتوصيات المدير المباشر
  evaluatedBy?: string;
  evaluatedAt?: string;
}

export interface Mission {
  id: string;
  employeeId: string;
  projectId?: string; // المأمورية متعلقة بمشروع
  startDate: string;
  endDate: string;
  missionTypeId: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'Executed';
  notes?: string;
  destination?: string;
  reason?: string;
  allowances?: MissionAllowance[];
  evaluation?: MissionEvaluation;
}

export type EmployeeStatus = 'Active' | 'Inactive' | 'End of Service' | 'Leave';
export type PaymentMethod = 'Bank' | 'Cash'; // Bank: استلام بنك, Cash: استلام راتب

export interface Employee {
  id: string;
  employeeId: string; // الرقم الوظيفي
  name: string; // الإسم
  iqamaNumber: string; // رقم الإقامة
  nationality: string; // الجنسية
  jobTitle: string; // المسمى الوظيفي
  joinDate: string; // بداية العمل
  workType: 'Full time' | 'Part time'; // نوع الدوام
  bankAccount: string; // الايبــــــــــان
  bankCode: string; // كود البنك
  paymentMethod: PaymentMethod; // نوع استلام الراتب
  basicSalary: number; // الراتب الاساسي
  housingAllowance: number; // بدل سكن
  transportAllowance: number; // بدل نقل
  subsistenceAllowance: number; // بدل إعاشه
  otherAllowances: number; // بدلات اخرى
  mobileAllowance: number; // بدل جوال
  managementAllowance: number; // بدل ادارة
  dailyWorkHours: number; // عدد ساعات يوم العمل
  status: EmployeeStatus;
  allowances: Allowance[]; // Dynamic allowances from DDL
  role?: UserRole;
  email?: string;
  userId?: string;
  shiftId?: string;
  managerId?: string; // ID of the manager
  directManagerId?: string; // ID of the direct manager
  departmentId?: string; // ID of the administrative department
  branchId?: string;
  legalEntity?: string;
  payrollGroup?: string;
  contractType?: string;
  endOfServiceDate?: string;
  insuranceProfile?: string;
  taxProfile?: string;
  leavePlan?: string;
  sickLeavePlan?: string;
  gradeLevel?: string;
  subjectToSi?: string;
  siNumber?: string;
  subjectToTax?: string;
  taxExempt?: string;
  activeDeductions?: string[] | string;
  exemptFromAppraisal?: string; // 'Yes' | 'No'
  workMode?: 'Office Work' | 'Remotely Work'; // طريقة العمل: Office Work أو Remotely Work
  subjectToAttendance?: 'Yes' | 'No' | string; // 'Yes' | 'No' (خاضع لنظام الحضور والانصراف)
  isSubjectToAttendance?: boolean;
  attendanceStatusEffectiveDate?: string; // تاريخ سريان الحالة
}

export interface Transaction {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  actualWorkDays: number; // عدد الايام العمل الفعلي
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  subsistenceAllowance: number;
  otherAllowances: number;
  mobileAllowance: number;
  managementAllowance: number;
  missionAllowance?: number;
  otherIncome: number; // اضافة الشهر دخل آخر
  overtimeHours: number; // عدد ساعات العمل الاضافي
  overtimeValue: number; // قيمة عمل اضافي
  totalIncome: number; // مجموع الدخل
  socialInsurance: number; // تامينات اجتماعية
  salaryReceived: number; // استلام راتب
  loans: number; // سلف
  bankReceived: number; // استلام بنك
  taxValue?: number; // ضريبة كسب العمل / Income Tax
  otherDeductions: number; // اقتطاعات اخرى
  deductionHours: number; // عدد الساعات
  departureDelayDeduction: number; // خصم المغادرات والتاخير
  absenceDays: number; // عدد ايام الغياب
  absenceDeduction: number; // خصم الغياب
  unpaidLeaveDays?: number; // عدد أيام الإجازة بدون راتب
  unpaidLeaveDeduction?: number; // خصم الإجازة بدون راتب
  totalDeductions: number; // مجموع الاقتطاعات
  netSalary: number; // صافي الراتب
  status: string; // الحالة
  salaryIncrease: number; // زيادة راتب
  otherIncomeReason?: string; // سبب الدخل الإضافي
  notes: string; // ملاحظات
  dailyWorkHours: number; // عدد ساعات يوم العمل
  createdAt: any;
}

export type ProjectStatus = 'Active' | 'Completed' | 'On Hold';
export type TaskStatus = 'Pending' | 'In Progress' | 'Under Review' | 'Approved' | 'Rejected' | 'Testing' | 'Executed';
export type ProjectPhase = 'Analysis' | 'Design' | 'Development';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  managerId?: string; // person reviewing
  startDate: string;
  endDate: string;
  daysCount?: number;
  type: string; // Sick, Vacation, OfficialHoliday, etc.
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Postponed';
  isPaid?: boolean;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
  actualReturnDate?: string;
  returnRequestStatus?: 'Pending' | 'Approved' | 'Rejected';
  returnRequestApprovedAt?: string;
  returnRequestNotes?: string;
}

export interface ProjectScope {
  id: string;
  name: string;
}

export interface ProjectVisit {
  id: string;
  date: string;
  title: string;
  employeeIds: string[];
  meetingMinutes?: string;
  attachmentUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  parentProjectId?: string; // لدعم المشروعات الفرعية
  clientName: string;
  description?: string;
  details?: string;          // تفاصيل إضافية عن المشروع
  projectManagerId: string; // مدير المشروع
  teamLeaderId: string;      // قائد الفريق
  consultantTlId?: string;   // قائد فريق الاستشاريين
  developerTlId?: string;    // قائد فريق المطورين
  phases: string[];          // المراحل الديناميكية (e.g. ['Analysis', 'Design', ...])
  scope?: ProjectScope[];    // نطاق المشروع (شرائح)
  visitFollowUps?: ProjectVisit[]; // كروت متابعة الزيارات
  startDate?: string;
  endDate?: string;
  status: ProjectStatus;
  chat?: TaskChatMessage[];  // المحادثة العامة للمشروع
  createdAt: string;
}

export interface SubTask {
  id: string;
  title: string;
  status: 'Pending' | 'Completed';
  createdAt: string;
}

export interface TaskChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  mentions?: string[];       // قائمة IDs الموظفين الذين تمت الإشارة إليهم
  createdAt: string;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  parentTaskId?: string; // لربط المهمات الفرعية بشجرة المهام الرئيسية
  title: string;
  description: string;
  phase: string;         // المرحلة (ديناميكية بناء على المشروع)
  subPhase?: string;     // e.g. 'Site Visit', 'CR', 'BUG'
  priority?: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  status: TaskStatus;
  creatorId: string;
  assignedTo?: string;
  assignedToId?: string;
  assignedToIds?: string[]; // Multiple assignees
  startDate?: string;    // بداية المهمة
  endDate?: string;      // نهاية المهمة
  actualStartDate?: string; // تاريخ البدء الفعلي المحدد من قبل الموظف
  actualStartTime?: string; // وقت البدء الفعلي (HH:mm)
  startedAt?: string;       // طابع زمني دقيق لبدء المهمة
  estimatedHours?: number; // الوقت المقدر بالساعات
  completedAt?: string;    // تاريخ ووقت الإنجاز
  completionNotes?: string; // ملاحظات الإنجاز
  delayHours?: number;     // ساعات التأخير المحسوبة
  isDelayed?: boolean;     // هل المهمة متأخرة عن الوقت المقدر
  subTasks?: SubTask[];    // المهمات الفرعية
  attachments?: { 
    name: string; 
    url: string; 
    uploadedBy: string; 
    timestamp: string;
    source: 'System' | 'Local';
    externalId?: string; 
  }[];
  comments?: TaskChatMessage[]; // تم استبدال TaskComment بـ TaskChatMessage
  workflowLog: WorkflowLog[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowLog {
  fromStatus: TaskStatus;
  toStatus: TaskStatus;
  userId: string;
  userName: string;
  timestamp: string;
  note?: string;
}

export interface AdministrativeDepartment {
  id: string;
  name: string;
  description?: string;
  managerId: string;
  parentDeptId?: string;
}

export interface PayrollRun {
  id: string;
  runNumber: string;
  month: string;
  periodFrom: string;
  periodTo: string;
  payrollGroup: string;
  legalEntity: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Locked';
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  employeeCount: number;
  createdBy?: string;
  createdAt?: string;
  submittedBy?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
  notes?: string;
  updatedAt: any;
}

export interface PayrollAdjustment {
  label: string;
  amount: number;
}

export interface PayrollResult {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  iqamaNumber?: string;
  workType?: 'Full time' | 'Part time';
  paymentMethod?: PaymentMethod;
  bankAccount: string;
  bankCode?: string;

  // Financial fields
  basicSalary: number;
  housingAllowance: number;
  grossBase: number;
  totalIncome: number;
  overtimeValue: number;
  absenceDeduction: number;
  totalDeductions: number;
  salaryReceived: number;
  bankReceived: number;
  otherEarnings: number;
  bankExportAmount: number;
  cashExportAmount: number;
  absenceDays?: number;
  unpaidLeaveDays?: number;
  unpaidLeaveDeduction?: number;
  netSalary: number;
  adjustments?: PayrollAdjustment[];
  detailedDeductions?: string | any[];
}

export interface SystemSettings {
  id: string;
  organizationName: string;
  logoUrl?: string;
  lockPassword?: string;
  idleTimeoutMinutes?: number;
  isLockEnabled?: boolean;
  overtimeRate?: number;
  delayHourlyRate?: number;
  updatedAt?: string;
  primaryColor?: string;
  secondaryColor?: string;
  sidebarColor?: string;
  buttonColor?: string;
  darkModeEnabled?: boolean;
  defaultLanguage?: string;
}

export interface EndOfServiceSettlement {
  id: string;
  employeeId: string;
  terminationDate: string;
  lastWorkingDay: string;
  reason: string;
  lastSalaryDue: number;
  leaveBalanceAmount: number;
  endOfServiceBenefit: number;
  loans: number;
  advances: number;
  deductions: number;
  custodyDeductions: number;
  insuranceDeductions: number;
  netSettlement: number;
  status: 'Draft' | 'HR Review' | 'Finance Review' | 'Approved' | 'Locked';
  hrNotes?: string;
  financeNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditTrailEntry {
  id?: string;
  timestamp: string;
  userName: string;
  userId?: string;
  action: string;
  comment?: string;
  previousStatus?: string;
  newStatus?: string;
}

export interface Penalty {
  id: string;
  penaltyNumber: string;
  employeeId: string;
  employeeName?: string;
  departmentId?: string;
  violationDate: string;
  penaltyDate: string;
  violationType: 'Delay' | 'Absence' | 'Early Departure' | 'Instruction Violation' | 'Misconduct' | 'Other' | string;
  description: string;
  attachmentUrl?: string;
  penaltyType: 'Warning' | 'Final Warning' | 'Amount Deduction' | 'Day Deduction' | string;
  deductionType?: 'Amount' | 'Days';
  deductionValue?: number;
  targetMonth?: string;
  fiscalYear?: string;
  submitterId?: string;
  approverId?: string;
  status: 'Draft' | 'Pending Direct Manager' | 'Pending Higher Manager' | 'Pending HR' | 'Pending Approval' | 'Returned' | 'Approved' | 'Rejected' | 'Cancelled' | string;
  adminNotes?: string;
  employeeNotes?: string;
  disciplinaryApprovalType?: 'Approved by Direct Manager' | 'Issued by Top Management';
  referenceNumber?: string;
  auditTrail?: AuditTrailEntry[];
  rejectionReason?: string;
  returnReason?: string;
  directManagerDecision?: 'Approved' | 'Objected' | string;
  directManagerObjectionReason?: string;
  directManagerNotes?: string;
  higherManagerDecision?: 'Approved' | 'Objected' | string;
  higherManagerObjectionReason?: string;
  higherManagerNotes?: string;
  hrDecision?: 'Approved' | 'Rejected' | 'Cancelled' | string;
  cancellationReason?: string;

  // Grievance (تظلم) fields
  hasGrievance?: boolean;
  grievanceStatus?: 'None' | 'Pending' | 'Accepted_Modified' | 'Rejected' | string;
  grievanceDate?: string;
  grievanceReason?: string;
  grievanceReply?: string;
  grievanceReplyDate?: string;
  grievanceResolvedBy?: string;

  // Before Grievance Snapshot (تسجيل الجزاء قبل التظلم)
  preGrievancePenaltyType?: string;
  preGrievanceDeductionType?: 'Amount' | 'Days' | string;
  preGrievanceDeductionValue?: number;
  preGrievanceDescription?: string;

  // After Grievance Snapshot (تسجيل الجزاء بعد التظلم والتعديل)
  postGrievancePenaltyType?: string;
  postGrievanceDeductionType?: 'Amount' | 'Days' | string;
  postGrievanceDeductionValue?: number;
  postGrievanceNotes?: string;

  createdAt?: string;
  updatedAt?: string;
}

export interface Investigation {
  id: string;
  investigationNumber: string;
  title: string;
  reason: string;
  investigationDate: string; // YYYY-MM-DD
  investigationTime: string; // HH:mm
  location?: string;
  employeeId?: string;
  employeeName?: string;
  employeeIds: string[];
  managerIds?: string[];
  investigatorName?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | string;
  notes?: string;
  recommendation?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// --- Performance Appraisal System Types ---

export interface PerformanceCycle {
  id: string;
  nameAr: string;
  nameEn: string;
  year: string;
  cycleType: string; // 'Annual' | 'Mid-Year' | 'Probationary' | 'Special'
  templateId?: string; // Linked mandatory evaluation template
  startDate: string;
  endDate: string;
  status: 'Draft' | 'Active' | 'Closed';
  targetDepartments?: string[]; // parsed from mode 'json' array of admin dept IDs
  requireSelfEval?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PerformanceCriteria {
  id: string;
  nameAr: string;
  nameEn: string;
  weight: number;
  responseType: string; // 'RatingStar' | 'RatingTen' | 'Percentage' | 'YesNo' | 'Text'
  criterionKey?: string; // 'tasks' | 'missions' | 'attendance' | 'leaves' | 'wfh' | 'investigations' | 'penalties' | 'custom'
  isEnabled?: boolean;
  isAutoCalculated?: boolean;
  descriptionAr?: string;
  descriptionEn?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TemplateSection {
  nameAr: string;
  nameEn: string;
  weight: number; // relative weight within template (0-100)
  criteriaIds: string[]; // references of standard criteria
}

export interface PerformanceTemplate {
  id: string;
  nameAr: string;
  nameEn: string;
  description?: string;
  jobTypes?: string; // 'all' | 'technical' | 'management' etc.
  targetDepartments?: string[]; // Array of admin department IDs, or ['all'] for generalized templates
  successRate: number;
  status: 'Active' | 'Inactive';
  sections: TemplateSection[]; // parsed from json mode array
  requireSelfEval?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type EvaluationStatus = 'Draft' | 'PendingSelf' | 'PendingManager' | 'PendingApproval' | 'Returned for Re-evaluation' | 'Approved' | 'Closed' | 'Rejected' | string;

export interface PerformanceEvaluation {
  id: string;
  employeeId: string;
  cycleId: string;
  templateId: string;
  managerId?: string;
  higherLevelManagerId?: string;
  deptHeadId?: string;
  hrId?: string;
  status: EvaluationStatus;
  rejectionReason?: string;
  returnReason?: string;
  auditTrail?: AuditTrailEntry[];

  selfWeight: number;
  managerWeight: number;
  deptHeadWeight: number;
  hrWeight: number;

  selfScores?: Record<string, any>; // criterion_id -> rating value or text
  managerScores?: Record<string, any>;
  deptHeadScores?: Record<string, any>;
  hrScores?: Record<string, any>;

  // System Auto-Calculated Scores & Breakdown
  systemCalculatedScore?: number;
  systemScoreBreakdown?: any;
  systemSuggestedPercentage?: number;

  // Higher Manager Final Decision
  higherManagerDecision?: 'AdoptSystem' | 'AdoptManager' | 'CustomScore' | string;
  higherManagerCustomScore?: number;
  higherManagerNotes?: string;
  decisionSource?: 'System' | 'Manager' | 'HigherManagerCustom' | string;
  isSelfEvaluationEnabled?: boolean;

  selfStrengths?: string;
  selfImprovements?: string;
  selfRecommendations?: string;

  managerStrengths?: string;
  managerImprovements?: string;
  managerRecommendations?: string;

  deptHeadStrengths?: string;
  deptHeadImprovements?: string;
  deptHeadRecommendations?: string;

  hrStrengths?: string;
  hrImprovements?: string;
  hrRecommendations?: string;

  finalPercentageScore: number;
  finalGrade?: string;
  workflowLog?: {
    stage: string;
    actor: string;
    action: string;
    date: string;
    notes: string;
  }[];

  isSelfSubmitted?: boolean;
  isManagerSubmitted?: boolean;
  isDeptHeadApproved?: boolean;
  isHrApproved?: boolean;

  createdAt?: string;
  updatedAt?: string;
}

export interface SmartObjective {
  objective: string;
  deadline: string;
  progress: number;
  title?: string;
  targetDate?: string;
  status?: string;
}

export interface TrainingCourse {
  courseName: string;
  status: 'Planned' | 'In Progress' | 'Completed' | string;
  provider?: string;
}

export interface DevelopmentPlan {
  id: string;
  employeeId: string;
  evaluationId?: string;
  weaknesses?: string[];
  trainingCourses?: TrainingCourse[];
  smartObjectives?: SmartObjective[];
  progressPercentage: number;
  status?: 'Active' | 'Completed' | string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export type NoticeCategory = 'decision' | 'greeting' | 'circular' | 'instruction' | 'event' | 'other';
export type NoticePriority = 'high' | 'normal' | 'urgent';

export interface AdministrativeNotice {
  id: string;
  title: string;
  content: string; // Rich-text HTML content
  noticeDate: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  durationDays?: number;
  isPermanent?: boolean;
  priority?: NoticePriority;
  category?: NoticeCategory;
  targetAudience?: string[]; // ['all'] or array of department/employee IDs
  createdByName: string;
  createdByRole?: string;
  createdById?: string;
  createdBy?: string;
  publisherId?: string;
  status: 'Published' | 'Draft' | 'Expired';
  readBy?: string[]; // Array of user/employee IDs
  createdAt?: string;
  updatedAt?: string;
}



