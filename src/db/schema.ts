import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// 1. App Users
export const appUsers = sqliteTable('app_users', {
  id: text('id').primaryKey(), // Unique user ID or email
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(), // HR, Finance, Admin, Viewer
  password: text('password'), // Add password field
  status: text('status').notNull().default('Active'),
  permissions: text('permissions', { mode: 'json' }), // Automatically parse/stringify
  photoUrl: text('photo_url'),
  lockPassword: text('lock_password'),
  employeeId: text('employee_id'), // Linked employee
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// 2. Administrative Departments
export const adminDepartments = sqliteTable('admin_departments', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  managerId: text('manager_id'),
  parentDeptId: text('parent_dept_id'),
});

// 3. Attendance Shifts
export const attendanceShifts = sqliteTable('attendance_shifts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  graceMinutes: integer('grace_minutes').default(0),
  workDays: text('work_days', { mode: 'json' }), // JSON string
});

// 4. Employees
export const employees = sqliteTable('employees', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().unique(), // الرقم الوظيفي
  name: text('name').notNull(),
  iqamaNumber: text('iqama_number'),
  nationality: text('nationality'),
  jobTitle: text('job_title'),
  joinDate: text('join_date'),
  workType: text('work_type'), // Full time, Part time
  bankAccount: text('bank_account'),
  bankCode: text('bank_code'),
  paymentMethod: text('payment_method'), // Bank, Cash
  basicSalary: real('basic_salary').default(0),
  housingAllowance: real('housing_allowance').default(0),
  transportAllowance: real('transport_allowance').default(0),
  subsistenceAllowance: real('subsistence_allowance').default(0),
  otherAllowances: real('other_allowances').default(0),
  mobileAllowance: real('mobile_allowance').default(0),
  managementAllowance: real('management_allowance').default(0),
  dailyWorkHours: integer('daily_work_hours').default(8),
  status: text('status').default('Active'),
  allowances: text('allowances', { mode: 'json' }), // JSON string
  role: text('role'),
  email: text('email'),
  shiftId: text('shift_id').references(() => attendanceShifts.id),
  managerId: text('manager_id'),
  departmentId: text('department_id').references(() => adminDepartments.id),
  branchId: text('branch_id'),
  legalEntity: text('legal_entity'),
  payrollGroup: text('payroll_group'),
  contractType: text('contract_type'),
  endOfServiceDate: text('end_of_service_date'),
  insuranceProfile: text('insurance_profile'),
  taxProfile: text('tax_profile'),
  leavePlan: text('leave_plan'),
  gradeLevel: text('grade_level'),
  subjectToSi: text('subject_to_si').default('No'),
  siNumber: text('si_number'),
  subjectToTax: text('subject_to_tax').default('No'),
  taxExempt: text('tax_exempt').default('No'),
  activeDeductions: text('active_deductions', { mode: 'json' }), // array of active deduction master IDs
  exemptFromAppraisal: text('exempt_from_appraisal').default('No'),
  workMode: text('work_mode').default('Office Work'), // Office Work, Remotely Work
  subjectToAttendance: text('subject_to_attendance').default('Yes'), // 'Yes' | 'No'
  attendanceStatusEffectiveDate: text('attendance_status_effective_date'),
});

// 5. Attendance Records
export const attendanceRecords = sqliteTable('attendance_records', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  timestamp: text('timestamp').notNull(),
  type: text('type').notNull(), // In, Out
  deviceId: text('device_id'),
  deviceName: text('device_name'),
  manual: integer('manual', { mode: 'boolean' }).default(false),
  note: text('note'),
});

// 6. Attendance Devices
export const attendanceDevices = sqliteTable('attendance_devices', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ipAddress: text('ip_address'),
  port: integer('port'),
  lastSync: text('last_sync'),
  status: text('status').default('Offline'),
});

// 7. Absence Types
export const absenceTypes = sqliteTable('absence_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  deductionRatio: real('deduction_ratio').default(1),
});

// 8. Absence Records
export const absenceRecords = sqliteTable('absence_records', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  date: text('date').notNull(),
  absenceTypeId: text('absence_type_id').references(() => absenceTypes.id),
  note: text('note'),
});

// 9. Allowance Types
export const allowanceTypes = sqliteTable('allowance_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
});

// 10. Mission Types
export const missionTypes = sqliteTable('mission_types', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  allowanceAmount: real('allowance_amount'),
  allowances: text('allowances', { mode: 'json' }), // JSON string
  projectIds: text('project_ids', { mode: 'json' }), // array of associated project IDs
});

// 11. Missions
export const missions = sqliteTable('missions', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  projectId: text('project_id'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  missionTypeId: text('mission_type_id').references(() => missionTypes.id),
  status: text('status').default('Pending'),
  notes: text('notes'),
  allowances: text('allowances', { mode: 'json' }), // JSON string
  evaluation: text('evaluation', { mode: 'json' }), // Manager evaluation on mission completion
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 12. Projects
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentProjectId: text('parent_project_id'),
  clientName: text('client_name'),
  description: text('description'),
  details: text('details'),
  projectManagerId: text('project_manager_id'),
  teamLeaderId: text('team_leader_id'),
  consultantTlId: text('consultant_tl_id'),
  developerTlId: text('developer_tl_id'),
  phases: text('phases', { mode: 'json' }), // JSON string
  startDate: text('start_date'),
  endDate: text('end_date'),
  status: text('status').default('Active'),
  scope: text('scope', { mode: 'json' }), // JSON string for Project Scope segments
  visitFollowUps: text('visitFollowUps', { mode: 'json' }), // JSON string for visit tracking
  chat: text('chat', { mode: 'json' }), // JSON string for chat messages
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// 13. Project Tasks
export const projectTasks = sqliteTable('project_tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  parentTaskId: text('parent_task_id'),
  title: text('title').notNull(),
  description: text('description'),
  phase: text('phase'),
  subPhase: text('sub_phase'),
  priority: text('priority').default('Medium'),
  status: text('status').default('Pending'),
  creatorId: text('creator_id'),
  assignedToId: text('assigned_to_id'),
  assignedTo: text('assigned_to'),
  assignedToIds: text('assigned_to_ids', { mode: 'json' }), // JSON string
  startDate: text('start_date'),
  endDate: text('end_date'),
  actualStartDate: text('actual_start_date'),
  actualStartTime: text('actual_start_time'),
  startedAt: text('started_at'),
  estimatedHours: real('estimated_hours'),
  completedAt: text('completed_at'),
  completionNotes: text('completion_notes'),
  subTasks: text('sub_tasks', { mode: 'json' }), // JSON string
  attachments: text('attachments', { mode: 'json' }), // JSON string
  comments: text('comments', { mode: 'json' }), // JSON string
  workflowLog: text('workflow_log', { mode: 'json' }), // JSON string
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 14. Transactions
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  month: text('month').notNull(), // YYYY-MM
  actualWorkDays: integer('actual_work_days'),
  basicSalary: real('basic_salary'),
  housingAllowance: real('housing_allowance'),
  transportAllowance: real('transport_allowance'),
  subsistenceAllowance: real('subsistence_allowance'),
  otherAllowances: real('other_allowances'),
  mobileAllowance: real('mobile_allowance'),
  managementAllowance: real('management_allowance'),
  missionAllowance: real('mission_allowance'),
  otherIncome: real('other_income'),
  overtimeHours: real('overtime_hours'),
  overtimeValue: real('overtime_value'),
  totalIncome: real('total_income'),
  socialInsurance: real('social_insurance'),
  salaryReceived: real('salary_received'),
  loans: real('loans'),
  bankReceived: real('bank_received'),
  taxValue: real('tax_value').default(0),
  otherDeductions: real('other_deductions'),
  deductionHours: real('deduction_hours'),
  departureDelayDeduction: real('departure_delay_deduction'),
  absenceDays: real('absence_days'),
  absenceDeduction: real('absence_deduction'),
  unpaidLeaveDays: real('unpaid_leave_days'),
  unpaidLeaveDeduction: real('unpaid_leave_deduction'),
  totalDeductions: real('total_deductions'),
  netSalary: real('net_salary'),
  status: text('status'),
  salaryIncrease: real('salary_increase'),
  otherIncomeReason: text('other_income_reason'),
  notes: text('notes'),
  dailyWorkHours: integer('daily_work_hours'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// 15. Payroll Runs
export const payrollRuns = sqliteTable('payroll_runs', {
  id: text('id').primaryKey(),
  runNumber: text('run_number').notNull(),
  month: text('month').notNull(),
  periodFrom: text('period_from'),
  periodTo: text('period_to'),
  payrollGroup: text('payroll_group'),
  legalEntity: text('legal_entity'),
  status: text('status').default('Draft'),
  totalGross: real('total_gross').default(0),
  totalDeductions: real('total_deductions').default(0),
  totalNet: real('total_net').default(0),
  employeeCount: integer('employee_count').default(0),
  createdBy: text('created_by'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  submittedBy: text('submitted_by'),
  submittedAt: text('submitted_at'),
  reviewedBy: text('reviewed_by'),
  reviewedAt: text('reviewed_at'),
  approvedBy: text('approved_by'),
  approvedAt: text('approved_at'),
  lockedBy: text('locked_by'),
  lockedAt: text('locked_at'),
  notes: text('notes'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 16. Leave Requests
export const leaveRequests = sqliteTable('leave_requests', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  managerId: text('manager_id'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  daysCount: integer('days_count'),
  type: text('type').notNull(),
  reason: text('reason'),
  attachmentUrl: text('attachment_url'),
  status: text('status').default('Pending'),
  workflowStatus: text('workflow_status'),
  reviewNote: text('review_note'),
  actualReturnDate: text('actual_return_date'),
  returnRequestStatus: text('return_request_status'),
  returnRequestNotes: text('return_request_notes'),
  returnRequestApprovedAt: text('return_request_approved_at'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 17. WiFi Attendance Networks
export const wifiAttendanceNetworks = sqliteTable('wifi_attendance_networks', {
  id: text('id').primaryKey(),
  networkName: text('network_name').notNull(),
  ssid: text('ssid'),
  publicIp: text('public_ip'),
  gatewayIp: text('gateway_ip'),
  allowedIpStart: text('allowed_ip_start'),
  allowedIpEnd: text('allowed_ip_end'),
  ipRangeCidr: text('ip_range_cidr'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  allowedRadiusMeters: integer('allowed_radius_meters').default(100),
  minimumRequiredMatches: integer('minimum_required_matches').default(2),
  branchId: text('branch_id'),
  appliesToType: text('applies_to_type'), // All, Branch, Department, Specific
  appliesToValue: text('applies_to_value'), // JSON array of IDs
  verificationMode: text('verification_mode'), // Strict, Flexible, etc.
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  allowCheckIn: integer('allow_check_in', { mode: 'boolean' }).default(true),
  allowCheckOut: integer('allow_check_out', { mode: 'boolean' }).default(true),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedBy: text('updated_by'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 18. Detailed Attendance Logs
export const attendanceLogs = sqliteTable('attendance_logs', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  attendanceDate: text('attendance_date').notNull(),
  actionType: text('action_type').notNull(), // CheckIn, CheckOut
  actionTime: text('action_time').notNull(),
  status: text('status').notNull(), // Success, Failed
  failureReason: text('failure_reason'),
  matchedNetworkId: text('matched_network_id').references(() => wifiAttendanceNetworks.id),
  publicIp: text('public_ip'),
  localIp: text('local_ip'),
  ssid: text('ssid'),
  gatewayIp: text('gateway_ip'),
  deviceId: text('device_id'),
  browserInfo: text('browser_info'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  accuracy: real('accuracy'),
  validationDetails: text('validation_details'),
  matchedRules: text('matched_rules'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// 19. Mission Requests (Refined)
export const missionRequests = sqliteTable('mission_requests', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  managerId: text('manager_id'),
  missionType: text('mission_type'),
  missionDate: text('mission_date').notNull(),
  fromTime: text('from_time'),
  toTime: text('to_time'),
  destination: text('destination'),
  purpose: text('purpose'),
  transportationRequired: integer('transportation_required', { mode: 'boolean' }),
  expectedCost: real('expected_cost'),
  attachmentUrl: text('attachment_url'),
  status: text('status').default('Pending'),
  workflowStatus: text('workflow_status'),
  evaluation: text('evaluation', { mode: 'json' }),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 20. Dashboard Notifications
export const dashboardNotifications = sqliteTable('dashboard_notifications', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  notificationType: text('notification_type'),
  title: text('title').notNull(),
  message: text('message'),
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// 17. Payroll Results (Shifted)
export const payrollResults = sqliteTable('payroll_results', {
  id: text('id').primaryKey(),
  payrollRunId: text('payroll_run_id').notNull().references(() => payrollRuns.id, { onDelete: 'cascade' }),
  employeeId: text('employee_id').notNull(),
  employeeName: text('employee_name').notNull(),
  iqamaNumber: text('iqama_number'),
  workType: text('work_type'),
  paymentMethod: text('payment_method'),
  bankAccount: text('bank_account'),
  bankCode: text('bank_code'),
  basicSalary: real('basic_salary'),
  housingAllowance: real('housing_allowance'),
  grossBase: real('gross_base'),
  totalIncome: real('total_income'),
  overtimeValue: real('overtime_value'),
  absenceDeduction: real('absence_deduction'),
  totalDeductions: real('total_deductions'),
  salaryReceived: real('salary_received'),
  bankReceived: real('bank_received'),
  otherEarnings: real('other_earnings'),
  bankExportAmount: real('bank_export_amount'),
  cashExportAmount: real('cash_export_amount'),
  otherIncome: real('other_income'),
  otherDeductions: real('other_deductions'),
  absenceDays: real('absence_days'),
  unpaidLeaveDays: real('unpaid_leave_days'),
  unpaidLeaveDeduction: real('unpaid_leave_deduction'),
  netSalary: real('net_salary'),
  detailedDeductions: text('detailed_deductions', { mode: 'json' }), // stores array of detailed calculated deductions [{nameAr, category, employeeVal, companyVal}]
});

// 18. System Logs (Shifted)
export const systemLogs = sqliteTable('system_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  userName: text('user_name'),
  action: text('action').notNull(), // create, update, delete, login
  entity: text('entity'), // employees, projects, etc.
  entityId: text('entity_id'),
  details: text('details', { mode: 'json' }), // Before/After data or specific info
  timestamp: text('timestamp').default('CURRENT_TIMESTAMP'),
});

// 21. System Settings
export const systemSettings = sqliteTable('system_settings', {
  id: text('id').primaryKey(), // We'll use 'global' as the ID
  organizationName: text('organization_name').notNull().default('OPerix'),
  logoUrl: text('logo_url'),
  lockPassword: text('lock_password'),
  idleTimeoutMinutes: integer('idle_timeout_minutes').default(5),
  isLockEnabled: integer('is_lock_enabled', { mode: 'boolean' }).default(false),
  primaryColor: text('primary_color').default('#0ea5e9'),
  secondaryColor: text('secondary_color').default('#10b981'),
  sidebarColor: text('sidebar_color').default('#0f172a'),
  buttonColor: text('button_color').default('#0ea5e9'),
  darkModeEnabled: integer('dark_mode_enabled', { mode: 'boolean' }).default(false),
  defaultLanguage: text('default_language').default('ar'),
  overtimeRate: real('overtime_rate').default(1.5),
  delayHourlyRate: real('delay_hourly_rate').default(1.0),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 22. Financial Advances
export const financialAdvances = sqliteTable('financial_advances', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  projectId: text('project_id'),
  month: text('month').notNull(),
  amount: real('amount').notNull().default(0),
  status: text('status').notNull().default('Draft'), // Draft, Paid, Liquidated
  notes: text('notes'),
  refNumber: text('ref_number'),
  createdAt: text('created_at').notNull(),
  disbursedAt: text('disbursed_at'),
});

// 23. Mission Disbursals
export const missionDisbursals = sqliteTable('mission_disbursals', {
  id: text('id').primaryKey(), // employeeId_month
  employeeId: text('employee_id').notNull(),
  month: text('month').notNull(),
  totalAmount: real('total_amount').notNull().default(0),
  paidAmount: real('paid_amount').notNull().default(0),
  status: text('status').notNull().default('Draft'), // Draft, Partial, Approved
  payments: text('payments').default('[]'), // JSON array of payment records
  notes: text('notes'),
});

// 24. Mission Allowance Runs
export const missionAllowanceRuns = sqliteTable('mission_allowance_runs', {
  id: text('id').primaryKey(),
  runNumber: text('run_number').notNull(),
  periodFrom: text('period_from').notNull(),
  periodTo: text('period_to').notNull(),
  status: text('status').notNull().default('Draft'), // Draft, Submitted, Under Review, Approved, Locked
  createdBy: text('created_by'),
  createdAt: text('created_at').notNull(),
  submittedBy: text('submitted_by'),
  submittedAt: text('submitted_at'),
  approvedBy: text('approved_by'),
  approvedAt: text('approved_at'),
  lockedBy: text('locked_by'),
  lockedAt: text('locked_at'),
  totalEmployees: integer('total_employees').default(0),
  totalMissions: integer('total_missions').default(0),
  totalAllowanceAmount: real('total_allowance_amount').default(0),
  notes: text('notes'),
});

// 25. Mission Allowance Run Lines
export const missionAllowanceRunLines = sqliteTable('mission_allowance_run_lines', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => missionAllowanceRuns.id, { onDelete: 'cascade' }),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  employeeName: text('employee_name').notNull(),
  missionId: text('mission_id').notNull(),
  missionDateFrom: text('mission_date_from'),
  missionDateTo: text('mission_date_to'),
  missionDays: integer('mission_days').default(1),
  destination: text('destination'),
  allowanceType: text('allowance_type'),
  dailyAllowanceRate: real('daily_allowance_rate').default(0),
  totalAllowanceAmount: real('total_allowance_amount').default(0),
  paymentMethod: text('payment_method'),
  bankAccount: text('bank_account'),
  cashAmount: real('cash_amount').default(0),
  bankAmount: real('bank_amount').default(0),
  status: text('status').default('Draft'),
  notes: text('notes'),
});

// 26. Audit Logs
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  timestamp: text('timestamp').notNull(),
  ipAddress: text('ip_address'),
});

// 27. End of Service Settlements
export const endOfServiceSettlements = sqliteTable('end_of_service_settlements', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  terminationDate: text('termination_date').notNull(),
  lastWorkingDay: text('last_working_day').notNull(),
  reason: text('reason').notNull(),
  lastSalaryDue: real('last_salary_due').default(0),
  leaveBalanceAmount: real('leave_balance_amount').default(0),
  endOfServiceBenefit: real('end_of_service_benefit').default(0),
  loans: real('loans').default(0),
  advances: real('advances').default(0),
  deductions: real('deductions').default(0),
  custodyDeductions: real('custody_deductions').default(0),
  insuranceDeductions: real('insurance_deductions').default(0),
  netSettlement: real('net_settlement').default(0),
  status: text('status').notNull().default('Draft'), // Draft, HR Review, Finance Review, Approved, Locked
  hrNotes: text('hr_notes'),
  financeNotes: text('finance_notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// 28. Violations & Penalties Table
export const penalties = sqliteTable('penalties', {
  id: text('id').primaryKey(),
  penaltyNumber: text('penalty_number').notNull(),
  employeeId: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  employeeName: text('employee_name'),
  departmentId: text('department_id'),
  violationDate: text('violation_date').notNull(),
  penaltyDate: text('penalty_date').notNull(),
  violationType: text('violation_type').notNull(), // Delay, Absence, Early Departure, Instruction Violation, Misconduct, Other
  description: text('description').notNull(),
  attachmentUrl: text('attachment_url'),
  penaltyType: text('penalty_type').notNull(), // Warning, Final Warning, Amount Deduction, Day Deduction
  deductionType: text('deduction_type'), // Amount, Days
  deductionValue: real('deduction_value').default(0),
  targetMonth: text('target_month'), // YYYY-MM
  fiscalYear: text('fiscal_year'), // e.g. 2026
  submitterId: text('submitter_id'),
  approverId: text('approver_id'),
  status: text('status').default('Draft'), // Draft, Pending Direct Manager, Pending Higher Manager, Pending HR, Approved, Rejected, Cancelled, Returned
  adminNotes: text('admin_notes'),
  employeeNotes: text('employee_notes'),
  disciplinaryApprovalType: text('disciplinary_approval_type').default('Approved by Direct Manager'), // Approved by Direct Manager, Issued by Top Management
  referenceNumber: text('reference_number'),
  auditTrail: text('audit_trail', { mode: 'json' }),
  rejectionReason: text('rejection_reason'),
  returnReason: text('return_reason'),
  directManagerDecision: text('direct_manager_decision'),
  directManagerObjectionReason: text('direct_manager_objection_reason'),
  directManagerNotes: text('direct_manager_notes'),
  higherManagerDecision: text('higher_manager_decision'),
  higherManagerObjectionReason: text('higher_manager_objection_reason'),
  higherManagerNotes: text('higher_manager_notes'),
  hrDecision: text('hr_decision'),
  cancellationReason: text('cancellation_reason'),

  // Grievance (تظلم) fields
  hasGrievance: integer('has_grievance', { mode: 'boolean' }).default(false),
  grievanceStatus: text('grievance_status').default('None'), // None, Pending, Accepted_Modified, Rejected
  grievanceDate: text('grievance_date'),
  grievanceReason: text('grievance_reason'),
  grievanceReply: text('grievance_reply'),
  grievanceReplyDate: text('grievance_reply_date'),
  grievanceResolvedBy: text('grievance_resolved_by'),

  // Snapshot before grievance
  preGrievancePenaltyType: text('pre_grievance_penalty_type'),
  preGrievanceDeductionType: text('pre_grievance_deduction_type'),
  preGrievanceDeductionValue: real('pre_grievance_deduction_value').default(0),
  preGrievanceDescription: text('pre_grievance_description'),

  // Snapshot after grievance
  postGrievancePenaltyType: text('post_grievance_penalty_type'),
  postGrievanceDeductionType: text('post_grievance_deduction_type'),
  postGrievanceDeductionValue: real('post_grievance_deduction_value').default(0),
  postGrievanceNotes: text('post_grievance_notes'),

  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 29. Deduction Types (Deduction Master / إعدادات الاستقطاعات)
export const deductionTypes = sqliteTable('deduction_master_types', {
  id: text('id').primaryKey(),
  code: text('code').notNull(), // Dynamic auto-generated e.g. DED-001
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  category: text('category').notNull(), // تأمينات - ضرائب - جزاءات - سلف - نقابة - صندوق - أخرى
  description: text('description'),
  status: text('status').default('Active'), // Active / Inactive (فعال / غير فعال)
  startDate: text('start_date'),
  endDate: text('end_date'),
  
  calculationMethod: text('calculation_method').notNull(), // مبلغ ثابت - نسبة مئوية - شرائح - معادلة - يدوي
  fixedAmount: real('fixed_amount').default(0),
  percentage: real('percentage').default(0),
  brackets: text('brackets', { mode: 'json' }), // array of brackets: { name, from, to, percentage }
  equation: text('equation'), // custom equation string
  
  chargeType: text('charge_type').notNull(), // يتحمله الموظف بالكامل - تتحمله الشركة بالكامل - مشاركة بين الموظف والشركة
  employeePercentage: real('employee_percentage').default(0),
  companyPercentage: real('company_percentage').default(0),
  employeeAmount: real('employee_amount').default(0),
  companyAmount: real('company_amount').default(0),
  
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 30. Deduction Transactions (نماذج الاستقطاعات)
export const deductionTransactions = sqliteTable('deduction_master_transactions', {
  id: text('id').primaryKey(),
  formNumber: text('form_number').notNull(),
  month: text('month').notNull(), // e.g. "06"
  year: text('year').notNull(), // e.g. "2026"
  company: text('company'),
  departmentId: text('department_id'),
  status: text('status').default('Draft'), // Draft / Approved
  notes: text('notes'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 31. Deduction Transaction Details (تفاصيل الاستقطاعات)
export const deductionTransactionLines = sqliteTable('deduction_master_transaction_lines', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').notNull().references(() => deductionTransactions.id, { onDelete: 'cascade' }),
  employeeId: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  deductionTypeId: text('deduction_type_id').notNull().references(() => deductionTypes.id),
  calculatedValue: real('calculated_value').default(0),
  companyValue: real('company_value').default(0),
  notes: text('notes'),
});

// 32. Performance Cycles (دورات التقييم)
export const performanceCycles = sqliteTable('performance_cycles', {
  id: text('id').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  year: text('year').notNull(),
  cycleType: text('cycle_type').notNull(), // Annual / Mid-Year / Probationary / Special
  templateId: text('template_id'), // Mandatory appraisal template linked to cycle
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  status: text('status').default('Draft'), // Draft / Active / Closed
  targetDepartments: text('target_departments', { mode: 'json' }), // JSON array of admin department IDs
  requireSelfEval: integer('require_self_eval', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 33. Performance Templates (قوالب التقييم)
export const performanceTemplates = sqliteTable('performance_templates', {
  id: text('id').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  description: text('description'),
  jobTypes: text('job_types'), // all / technical / leadership / operations etc
  targetDepartments: text('target_departments', { mode: 'json' }), // JSON array of admin department IDs or ['all']
  successRate: real('success_rate').default(70),
  status: text('status').default('Active'), // Active / Inactive
  sections: text('sections', { mode: 'json' }), // JSON layout containing sections, their weights, and criteria IDs
  requireSelfEval: integer('require_self_eval', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 34. Performance Criteria (معايير التقييم)
export const performanceCriteria = sqliteTable('performance_criteria', {
  id: text('id').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  weight: real('weight').default(10),
  responseType: text('response_type').notNull(), // RatingStar (1-5) / RatingTen (1-10) / Percentage / YesNo / Text
  criterionKey: text('criterion_key'), // tasks / missions / attendance / leaves / wfh / investigations / penalties / custom
  isEnabled: integer('is_enabled', { mode: 'boolean' }).default(true),
  isAutoCalculated: integer('is_auto_calculated', { mode: 'boolean' }).default(false),
  descriptionAr: text('description_ar'),
  descriptionEn: text('description_en'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 35. Performance Evaluations (تنفيذ التقييم وسير العمل)
export const performanceEvaluations = sqliteTable('performance_evaluations', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id),
  cycleId: text('cycle_id').notNull().references(() => performanceCycles.id),
  templateId: text('template_id').notNull().references(() => performanceTemplates.id),
  managerId: text('manager_id'), // appUsers or employees linked manager id
  higherLevelManagerId: text('higher_level_manager_id'),
  deptHeadId: text('dept_head_id'),
  hrId: text('hr_id'),
  status: text('status').default('PendingSelf'), // PendingSelf / PendingManager / PendingApproval / Returned for Re-evaluation / Approved / Closed / Rejected
  returnReason: text('return_reason'),
  rejectionReason: text('rejection_reason'),
  auditTrail: text('audit_trail', { mode: 'json' }),
  
  // Custom Dynamic Workflows weight distribution
  selfWeight: real('self_weight').default(10),
  managerWeight: real('manager_weight').default(60),
  deptHeadWeight: real('dept_head_weight').default(20),
  hrWeight: real('hr_weight').default(10),

  // Log of scores and questions
  selfScores: text('self_scores', { mode: 'json' }), // map of criteria ID to actual value/rating selected
  managerScores: text('manager_scores', { mode: 'json' }),
  deptHeadScores: text('dept_head_scores', { mode: 'json' }),
  hrScores: text('hr_scores', { mode: 'json' }),

  // System Auto-Calculated Scores & Breakdown
  systemCalculatedScore: real('system_calculated_score').default(0),
  systemScoreBreakdown: text('system_score_breakdown', { mode: 'json' }),
  systemSuggestedPercentage: real('system_suggested_percentage').default(0),

  // Higher Manager Final Decision
  higherManagerDecision: text('higher_manager_decision'), // 'AdoptSystem' | 'AdoptManager' | 'CustomScore'
  higherManagerCustomScore: real('higher_manager_custom_score'),
  higherManagerNotes: text('higher_manager_notes'),
  decisionSource: text('decision_source'), // 'System' | 'Manager' | 'HigherManagerCustom'
  isSelfEvaluationEnabled: integer('is_self_evaluation_enabled', { mode: 'boolean' }).default(true),

  // Custom feedback inputs per workflow layer
  selfStrengths: text('self_strengths'),
  selfImprovements: text('self_improvements'),
  selfRecommendations: text('self_recommendations'),

  managerStrengths: text('manager_strengths'),
  managerImprovements: text('manager_improvements'),
  managerRecommendations: text('manager_recommendations'),

  deptHeadStrengths: text('dept_head_strengths'),
  deptHeadImprovements: text('dept_head_improvements'),
  deptHeadRecommendations: text('dept_head_recommendations'),

  hrStrengths: text('hr_strengths'),
  hrImprovements: text('hr_improvements'),
  hrRecommendations: text('hr_recommendations'),

  finalPercentageScore: real('final_percentage_score').default(0),
  finalGrade: text('final_grade'), // Outstanding / Exceeds / Meets / NeedsImprovement / Unsatisfactory
  workflowLog: text('workflow_log', { mode: 'json' }), // array of: { stage: string, actor: string, action: string, date: string, notes: string }
  
  isSelfSubmitted: integer('is_self_submitted', { mode: 'boolean' }).default(false),
  isManagerSubmitted: integer('is_manager_submitted', { mode: 'boolean' }).default(false),
  isDeptHeadApproved: integer('is_dept_head_approved', { mode: 'boolean' }).default(false),
  isHrApproved: integer('is_hr_approved', { mode: 'boolean' }).default(false),

  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 36. Performance Development Plans (خطط التطوير والنمو المهني)
export const performanceDevelopmentPlans = sqliteTable('performance_development_plans', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  evaluationId: text('evaluation_id').notNull().references(() => performanceEvaluations.id, { onDelete: 'cascade' }),
  weaknesses: text('weaknesses', { mode: 'json' }), // JSON array of string identified weaknesses
  trainingCourses: text('training_courses', { mode: 'json' }), // JSON array of { courseName: string, status: string }
  smartObjectives: text('smart_objectives', { mode: 'json' }), // JSON array of { objective: string, deadline: string, progress: number }
  progressPercentage: real('progress_percentage').default(0),
  status: text('status').default('Active'), // Active / Completed
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 37. Administrative Notices (التنبيهات الإدارية والقرارات)
export const administrativeNotices = sqliteTable('administrative_notices', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  content: text('content').notNull(), // Rich text HTML formatted content
  noticeDate: text('notice_date').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  durationDays: integer('duration_days').default(7),
  isPermanent: integer('is_permanent', { mode: 'boolean' }).default(false),
  priority: text('priority').default('normal'), // high, normal, urgent
  category: text('category').default('decision'), // decision, greeting, circular, instruction, event, other
  targetAudience: text('target_audience', { mode: 'json' }), // ['all'] or array of department/employee IDs
  createdByName: text('created_by_name').notNull(),
  createdByRole: text('created_by_role'),
  createdById: text('created_by_id'),
  status: text('status').default('Published'), // Published, Draft, Expired
  readBy: text('read_by', { mode: 'json' }), // Array of user IDs or employee IDs who read this notice
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// 38. Investigations (التحقيقات الإدارية)
export const investigations = sqliteTable('investigations', {
  id: text('id').primaryKey(),
  investigationNumber: text('investigation_number').notNull(),
  title: text('title').notNull(),
  reason: text('reason').notNull(),
  investigationDate: text('investigation_date').notNull(),
  investigationTime: text('investigation_time').notNull(),
  location: text('location'),
  employeeId: text('employee_id'),
  employeeName: text('employee_name'),
  employeeIds: text('employee_ids', { mode: 'json' }),
  managerIds: text('manager_ids', { mode: 'json' }),
  investigatorName: text('investigator_name'),
  status: text('status').default('Scheduled'), // Scheduled, Completed, Cancelled
  notes: text('notes'),
  recommendation: text('recommendation'),
  createdBy: text('created_by'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});





