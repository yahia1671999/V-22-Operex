import { 
  Employee, 
  ProjectTask, 
  Mission, 
  AttendanceRecord, 
  LeaveRequest, 
  Penalty, 
  Investigation,
  PerformanceCriteria,
  PerformanceTemplate
} from '../types';
import { calculateTaskDelay } from '../lib/taskUtils';

export interface CriterionCalculationDetail {
  labelAr: string;
  labelEn: string;
  value: string | number;
  badgeColor?: string;
}

export interface CalculatedCriterionResult {
  criterionId: string;
  criterionKey: string; // 'tasks' | 'missions' | 'attendance' | 'leaves' | 'wfh' | 'investigations' | 'penalties' | 'custom'
  nameAr: string;
  nameEn: string;
  configuredWeight: number; // The static weight in template
  effectiveWeight: number; // The normalized weight applied to this employee
  score: number; // 0 - 100%
  isApplicable: boolean; // false if excluded (e.g. 0 missions)
  notApplicableReason?: string;
  details: CriterionCalculationDetail[];
  summaryNoteAr?: string;
  summaryNoteEn?: string;
}

export interface PerformanceAutoScoreResult {
  employeeId: string;
  employeeName?: string;
  overallScore: number; // 0 - 100%
  systemSuggestedPercentage: number;
  finalGrade: {
    ar: string;
    en: string;
    gradeCode: 'A' | 'B' | 'C' | 'D' | 'F';
    badgeClass: string;
  };
  totalConfiguredWeight: number;
  totalApplicableWeight: number;
  criteriaResults: CalculatedCriterionResult[];
  calculatedAt: string;
}

export interface EvaluationDataContext {
  employee: Employee;
  tasks: ProjectTask[];
  missions: Mission[];
  attendanceLogs: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  wfhRequests?: any[];
  penalties: Penalty[];
  investigations: Investigation[];
  criteriaList: PerformanceCriteria[];
  template?: PerformanceTemplate | null;
  startDate?: string;
  endDate?: string;
}

/**
 * Standard System Default Criteria Definitions
 */
export const DEFAULT_SYSTEM_CRITERIA: Array<Partial<PerformanceCriteria> & { criterionKey: string }> = [
  {
    id: 'crit-tasks',
    nameAr: 'إنجاز المهام والالتزام بالوقت',
    nameEn: 'Task Execution & Timeliness',
    criterionKey: 'tasks',
    weight: 25,
    responseType: 'RatingStar',
    descriptionAr: 'يقيس نسبة إنجاز المهام المسندة، والالتزام بمواعيد التسليم، ونسبة الوقت التقديري مقارنة بالوقت الفعلي للتنفيذ.',
    descriptionEn: 'Evaluates task completion rate, delivery on time, and estimated vs actual time performance.'
  },
  {
    id: 'crit-missions',
    nameAr: 'تقييم وجودة تنفيذ المأموريات',
    nameEn: 'Missions Performance & Execution',
    criterionKey: 'missions',
    weight: 15,
    responseType: 'RatingStar',
    descriptionAr: 'يقيس كفاءة وجودة إنجاز المأموريات المكلف بها الموظف (يُطبق فقط في حال وجود مأموريات للموظف ولا يؤثر سلباً في حال عدم وجودها).',
    descriptionEn: 'Evaluates mission performance score. Strictly applies only if employee was assigned missions.'
  },
  {
    id: 'crit-attendance',
    nameAr: 'الانضباط بالحضور والانصراف والمواعيد',
    nameEn: 'Attendance & Punctuality',
    criterionKey: 'attendance',
    weight: 20,
    responseType: 'RatingStar',
    descriptionAr: 'يقيس نسبة الحضور الفعلي والالتزام بمواعيد الحضور وتجنب التأخيرات أو الخروج المبكر.',
    descriptionEn: 'Tracks attendance rate, punctuality, and absence from work.'
  },
  {
    id: 'crit-leaves',
    nameAr: 'الالتزام بسياسات الإجازات',
    nameEn: 'Leave Policy Compliance',
    criterionKey: 'leaves',
    weight: 10,
    responseType: 'RatingStar',
    descriptionAr: 'يقيس الالتزام بالإجازات المعتمدة وعدم الانقطاع بدون إذن أو تجاوز الأرصدة المقررة.',
    descriptionEn: 'Evaluates adherence to leave approvals and absence policies.'
  },
  {
    id: 'crit-wfh',
    nameAr: 'العمل عن بعد والإنتاجية',
    nameEn: 'Work From Home Productivity',
    criterionKey: 'wfh',
    weight: 10,
    responseType: 'RatingStar',
    descriptionAr: 'يقيس الالتزام بطلبات العمل عن بعد المعتمدة وإنجاز المهام المطلوبة خلالها.',
    descriptionEn: 'Evaluates approved work from home requests and task deliveries during remote work.'
  },
  {
    id: 'crit-investigations',
    nameAr: 'السجل الإداري والتحقيقات',
    nameEn: 'Administrative Investigations Record',
    criterionKey: 'investigations',
    weight: 10,
    responseType: 'RatingStar',
    descriptionAr: 'يقيس خلو السجل الإداري من أي تحقيقات أو مخالفات إدارية رسمية.',
    descriptionEn: 'Evaluates administrative investigations record and official compliance.'
  },
  {
    id: 'crit-penalties',
    nameAr: 'الانضباط والجزاءات الإدارية',
    nameEn: 'Disciplinary Penalties & Violations Record',
    criterionKey: 'penalties',
    weight: 10,
    responseType: 'RatingStar',
    descriptionAr: 'يقيس خلو السجل من الجزاءات التأديبية أو الخصومات والإنذارات المعتمدة.',
    descriptionEn: 'Tracks disciplinary penalties, warnings, and deductions.'
  }
];

/**
 * Determine criterion key based on criterion properties and names
 */
export function identifyCriterionKey(criterion: PerformanceCriteria): string {
  const anyCrit = criterion as any;
  if (anyCrit.criterionKey) return anyCrit.criterionKey;

  const text = `${criterion.nameAr || ''} ${criterion.nameEn || ''}`.toLowerCase();
  if (text.includes('مهم') || text.includes('مهام') || text.includes('task')) return 'tasks';
  if (text.includes('مأموري') || text.includes('ماموري') || text.includes('mission')) return 'missions';
  if (text.includes('حضور') || text.includes('انصراف') || text.includes('attend') || text.includes('punctual')) return 'attendance';
  if (text.includes('إجاز') || text.includes('اجاز') || text.includes('leave') || text.includes('غياب')) return 'leaves';
  if (text.includes('عن بعد') || text.includes('من المنزل') || text.includes('wfh') || text.includes('remote') || text.includes('home')) return 'wfh';
  if (text.includes('تحقيق') || text.includes('investigat')) return 'investigations';
  if (text.includes('جزاء') || text.includes('مخالف') || text.includes('penalt') || text.includes('violat')) return 'penalties';

  return 'custom';
}

/**
 * Helper to match employee identity across varied ID fields
 */
function isEmployeeMatch(candidate: any, emp: Employee): boolean {
  if (!candidate) return false;
  const empIds = [emp.id, emp.employeeId, emp.userId, emp.email, emp.name]
    .filter(Boolean)
    .map(x => String(x).trim().toLowerCase());

  if (typeof candidate === 'string') {
    const trimmed = candidate.trim().toLowerCase();
    if (empIds.includes(trimmed)) return true;
    try {
      if (candidate.startsWith('[') && candidate.endsWith(']')) {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed) && parsed.some(p => empIds.includes(String(p).trim().toLowerCase()))) {
          return true;
        }
      }
    } catch {
      // not json
    }
  } else if (Array.isArray(candidate)) {
    return candidate.some(c => empIds.includes(String(c).trim().toLowerCase()));
  }
  return false;
}

/**
 * Calculate Grade and Badge information from final percentage
 */
export function getPerformanceGrade(score: number): {
  ar: string;
  en: string;
  gradeCode: 'A' | 'B' | 'C' | 'D' | 'F';
  badgeClass: string;
} {
  if (score >= 90) {
    return {
      ar: 'ممتاز (A)',
      en: 'Excellent (A)',
      gradeCode: 'A',
      badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-500'
    };
  }
  if (score >= 80) {
    return {
      ar: 'جيد جداً (B)',
      en: 'Very Good (B)',
      gradeCode: 'B',
      badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-500'
    };
  }
  if (score >= 70) {
    return {
      ar: 'جيد (C)',
      en: 'Good (C)',
      gradeCode: 'C',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-500'
    };
  }
  if (score >= 60) {
    return {
      ar: 'مقبول (D)',
      en: 'Pass (D)',
      gradeCode: 'D',
      badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-500'
    };
  }
  return {
    ar: 'ضعيف (F)',
    en: 'Unsatisfactory (F)',
    gradeCode: 'F',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-500'
  };
}

/**
 * Core Evaluation Calculation Engine
 */
export function calculateEmployeePerformance(ctx: EvaluationDataContext): PerformanceAutoScoreResult {
  const {
    employee,
    tasks = [],
    missions = [],
    attendanceLogs = [],
    leaveRequests = [],
    wfhRequests = [],
    penalties = [],
    investigations = [],
    criteriaList = [],
    template
  } = ctx;

  // Compile active criteria list (use template sections or provided criteriaList or defaults)
  let activeCriteria: PerformanceCriteria[] = [];
  if (template?.sections && template.sections.length > 0) {
    const includedIds = new Set<string>();
    template.sections.forEach(s => s.criteriaIds?.forEach(id => includedIds.add(id)));
    activeCriteria = criteriaList.filter(c => includedIds.has(c.id));
  }
  if (activeCriteria.length === 0) {
    activeCriteria = criteriaList.length > 0 ? criteriaList : (DEFAULT_SYSTEM_CRITERIA as PerformanceCriteria[]);
  }

  const criteriaResults: CalculatedCriterionResult[] = [];

  for (const crit of activeCriteria) {
    const key = identifyCriterionKey(crit);
    const configuredWeight = Number(crit.weight) || 10;

    switch (key) {
      case 'tasks': {
        // Match tasks assigned to this employee
        const empTasks = tasks.filter(t => 
          isEmployeeMatch(t.assignedToId, employee) ||
          isEmployeeMatch(t.assignedTo, employee) ||
          isEmployeeMatch(t.assignedToIds, employee)
        );

        if (empTasks.length === 0) {
          // If no tasks assigned, perfect baseline
          criteriaResults.push({
            criterionId: crit.id,
            criterionKey: 'tasks',
            nameAr: crit.nameAr,
            nameEn: crit.nameEn,
            configuredWeight,
            effectiveWeight: configuredWeight,
            score: 100,
            isApplicable: true,
            details: [
              { labelAr: 'إجمالي المهام المسندة', labelEn: 'Assigned Tasks', value: 0 },
              { labelAr: 'حالة الإنجاز', labelEn: 'Status', value: 'سجل نظيف (لا توجد مهام متأخرة)' }
            ],
            summaryNoteAr: 'لا توجد مهام مسندة للموظف خلال الدورة.',
            summaryNoteEn: 'No tasks assigned during the cycle period.'
          });
        } else {
          const total = empTasks.length;
          const isTaskCompleted = (t: ProjectTask) => 
            t.status === 'Executed' || t.status === 'Approved' || !!t.completedAt;

          const completed = empTasks.filter(isTaskCompleted).length;
          const completionRate = Math.round((completed / total) * 100);

          // Check on-time completion and delay using unified task delay calculation
          const delayedTasks = empTasks.filter(t => {
            const delayInfo = calculateTaskDelay(t);
            return delayInfo.isDelayed;
          }).length;

          const onTimeRate = Math.max(0, Math.round(((total - delayedTasks) / total) * 100));

          // Time efficiency: Estimated Hours vs Delay Hours (Planned End Time)
          let efficiencySum = 0;
          let evaluatedWithHours = 0;
          empTasks.forEach(t => {
            const est = Number(t.estimatedHours) || 0;
            const delayInfo = calculateTaskDelay(t);
            const delay = delayInfo.delayHours;
            if (est > 0) {
              evaluatedWithHours++;
              if (delay <= 0) {
                efficiencySum += 100;
              } else {
                const overrunPct = (delay / est) * 100;
                efficiencySum += Math.max(25, 100 - overrunPct);
              }
            }
          });
          const timeEfficiencyRate = evaluatedWithHours > 0 ? Math.round(efficiencySum / evaluatedWithHours) : 100;

          // Composite Task Score: 40% Completion + 35% On-Time + 25% Time Efficiency
          const taskScore = Math.min(100, Math.max(0, Math.round(
            completionRate * 0.40 + onTimeRate * 0.35 + timeEfficiencyRate * 0.25
          )));

          criteriaResults.push({
            criterionId: crit.id,
            criterionKey: 'tasks',
            nameAr: crit.nameAr,
            nameEn: crit.nameEn,
            configuredWeight,
            effectiveWeight: configuredWeight,
            score: taskScore,
            isApplicable: true,
            details: [
              { labelAr: 'إجمالي المهام المسندة', labelEn: 'Total Tasks', value: total },
              { labelAr: 'المهام المنجزة بنجاح', labelEn: 'Completed Tasks', value: completed },
              { labelAr: 'نسبة الإنجاز (Completion Rate)', labelEn: 'Completion Rate', value: `${completionRate}%` },
              { labelAr: 'الالتزام بمواعيد التسليم (On-Time)', labelEn: 'On-Time Delivery', value: `${onTimeRate}%` },
              { labelAr: 'كفاءة الوقت الفعلي مقابل التقديري', labelEn: 'Estimated vs Actual Time', value: `${timeEfficiencyRate}%` }
            ],
            summaryNoteAr: `تم إنجاز ${completed} من إجمالي ${total} مهمة بنسبة التزام زمني ${onTimeRate}%.`,
            summaryNoteEn: `Completed ${completed}/${total} tasks with ${onTimeRate}% on-time rate.`
          });
        }
        break;
      }

      case 'missions': {
        // Match missions assigned to this employee
        const empMissions = missions.filter(m => 
          isEmployeeMatch(m.employeeId, employee) &&
          (m.status === 'Approved' || m.status === 'Completed' || m.status === 'Executed' || (m as any).status === 'Executed_Closed')
        );

        // CRITICAL REQUIREMENT:
        // "لا يتم احتساب معيار المأموريات على الموظف الذي لا توجد لديه مأموريات، ولا يؤثر ذلك سلبًا على تقييمه."
        if (empMissions.length === 0) {
          criteriaResults.push({
            criterionId: crit.id,
            criterionKey: 'missions',
            nameAr: crit.nameAr,
            nameEn: crit.nameEn,
            configuredWeight,
            effectiveWeight: 0, // EXCLUDED from calculation
            score: 100,
            isApplicable: false,
            notApplicableReason: 'لا توجد مأموريات مسندة للموظف خلال الفترة - تم استبعاد المعيار وإعادة موازنة الوزن تلقائياً دون أي تأثير سلبي.',
            details: [
              { labelAr: 'حالة المعيار', labelEn: 'Criterion Status', value: 'غير منطبق (Not Applicable)' },
              { labelAr: 'عدد المأموريات', labelEn: 'Missions Count', value: 0 },
              { labelAr: 'الوزن الفعلي المطبق', labelEn: 'Effective Weight', value: '0% (موزع على باقي المعايير)' }
            ],
            summaryNoteAr: 'لم يُكلف الموظف بمأموريات رسمية، وتم استبعاد وزن المعيار وإعادة توزيعه بالكامل.',
            summaryNoteEn: 'Employee had no missions assigned; weight dynamically excluded and normalized.'
          });
        } else {
          // Employee has missions! Calculate average evaluation
          let ratingSum = 0;
          let evaluatedMissions = 0;

          empMissions.forEach(m => {
            const rating = Number((m as any).performanceRating || (m as any).rating || (m as any).evaluationScore) || 0;
            if (rating > 0) {
              evaluatedMissions++;
              // If rating is on 1-5 scale, convert to % (e.g. 5 = 100%, 4 = 80%)
              const pct = rating <= 5 ? (rating / 5) * 100 : Math.min(100, rating);
              ratingSum += pct;
            } else if (m.status === 'Completed' || m.status === 'Executed') {
              // Completed mission without rating defaults to full completion credit
              evaluatedMissions++;
              ratingSum += 100;
            }
          });

          const missionsScore = evaluatedMissions > 0 ? Math.round(ratingSum / evaluatedMissions) : 100;

          criteriaResults.push({
            criterionId: crit.id,
            criterionKey: 'missions',
            nameAr: crit.nameAr,
            nameEn: crit.nameEn,
            configuredWeight,
            effectiveWeight: configuredWeight,
            score: missionsScore,
            isApplicable: true,
            details: [
              { labelAr: 'إجمالي المأموريات المنفذة', labelEn: 'Executed Missions', value: empMissions.length },
              { labelAr: 'المأموريات المقيمة رسمياً', labelEn: 'Evaluated Missions', value: evaluatedMissions },
              { labelAr: 'متوسط تقييم المأموريات', labelEn: 'Average Mission Score', value: `${missionsScore}%` }
            ],
            summaryNoteAr: `تم تقييم ${empMissions.length} مأمورية بمتوسط جودة أداء ${missionsScore}%.`,
            summaryNoteEn: `Evaluated ${empMissions.length} missions with average rating of ${missionsScore}%.`
          });
        }
        break;
      }

      case 'attendance': {
        const empAttendance = attendanceLogs.filter(a => isEmployeeMatch(a.employeeId, employee));

        if (empAttendance.length === 0) {
          criteriaResults.push({
            criterionId: crit.id,
            criterionKey: 'attendance',
            nameAr: crit.nameAr,
            nameEn: crit.nameEn,
            configuredWeight,
            effectiveWeight: configuredWeight,
            score: 100,
            isApplicable: true,
            details: [
              { labelAr: 'حالة الحضور', labelEn: 'Attendance Status', value: 'سجل منتظم' },
              { labelAr: 'إجمالي السجلات', labelEn: 'Records Count', value: 0 }
            ],
            summaryNoteAr: 'سجل حضور قياسي مكتمل.',
            summaryNoteEn: 'Standard clean attendance record.'
          });
        } else {
          // Track late minutes and absence days
          const lateLogs = empAttendance.filter(a => (Number((a as any).lateMinutes) || 0) > 10);
          const totalLateMins = empAttendance.reduce((sum, a) => sum + (Number((a as any).lateMinutes) || 0), 0);
          
          // Deduct 1% per 20 minutes of late check-ins, max deduction 50%
          const lateDeduction = Math.min(50, Math.round(totalLateMins / 20));
          const attendanceScore = Math.max(40, 100 - lateDeduction);

          criteriaResults.push({
            criterionId: crit.id,
            criterionKey: 'attendance',
            nameAr: crit.nameAr,
            nameEn: crit.nameEn,
            configuredWeight,
            effectiveWeight: configuredWeight,
            score: attendanceScore,
            isApplicable: true,
            details: [
              { labelAr: 'إجمالي بصمات الحضور المسجلة', labelEn: 'Attendance Records', value: empAttendance.length },
              { labelAr: 'مرات التأخير المرصودة', labelEn: 'Late Check-ins', value: lateLogs.length },
              { labelAr: 'إجمالي دقائق التأخير', labelEn: 'Total Late Minutes', value: `${totalLateMins} دقيقة` },
              { labelAr: 'درجة الالتزام بالمواعيد', labelEn: 'Punctuality Score', value: `${attendanceScore}%` }
            ],
            summaryNoteAr: `نسبة انضباط الحضور ${attendanceScore}% مع تسجيل ${totalLateMins} دقيقة تأخير تراكمي.`,
            summaryNoteEn: `Attendance adherence at ${attendanceScore}% with ${totalLateMins} total late mins.`
          });
        }
        break;
      }

      case 'leaves': {
        const empLeaves = leaveRequests.filter(l => isEmployeeMatch(l.employeeId, employee));
        const unapprovedLeaves = empLeaves.filter(l => l.status === 'Rejected');
        const unpaidLeaves = empLeaves.filter(l => l.type === 'Unpaid' && l.status === 'Approved');

        let leafScore = 100;
        // Deduct 15% per rejected leave
        leafScore -= unapprovedLeaves.length * 15;
        // Deduct for excessive unpaid leaves
        if (unpaidLeaves.length > 2) {
          leafScore -= (unpaidLeaves.length - 2) * 10;
        }
        leafScore = Math.max(30, Math.min(100, leafScore));

        criteriaResults.push({
          criterionId: crit.id,
          criterionKey: 'leaves',
          nameAr: crit.nameAr,
          nameEn: crit.nameEn,
          configuredWeight,
          effectiveWeight: configuredWeight,
          score: leafScore,
          isApplicable: true,
          details: [
            { labelAr: 'إجمالي طلبات الإجازات', labelEn: 'Total Leave Requests', value: empLeaves.length },
            { labelAr: 'الإجازات المعتمدة نظامياً', labelEn: 'Approved Leaves', value: empLeaves.filter(l => l.status === 'Approved').length },
            { labelAr: 'الطلبات المرفوضة/غير المعتمدة', labelEn: 'Rejected / Unexcused', value: unapprovedLeaves.length },
            { labelAr: 'درجة الالتزام بسياسات الإجازات', labelEn: 'Compliance Score', value: `${leafScore}%` }
          ],
          summaryNoteAr: `تم تسجيل ${empLeaves.length} طلب إجازة مع نسبة التزام بالسياسات بلغت ${leafScore}%.`,
          summaryNoteEn: `Processed ${empLeaves.length} leave requests with ${leafScore}% policy compliance.`
        });
        break;
      }

      case 'wfh': {
        const empWfh = (wfhRequests || []).filter(w => isEmployeeMatch(w.employeeId, employee));
        const empWfhFromLeaves = leaveRequests.filter(l => isEmployeeMatch(l.employeeId, employee) && l.type === 'WorkFromHome');
        const combinedWfhCount = empWfh.length + empWfhFromLeaves.length;

        if (combinedWfhCount === 0) {
          // If employee had no WFH, treated as clean neutral compliance
          criteriaResults.push({
            criterionId: crit.id,
            criterionKey: 'wfh',
            nameAr: crit.nameAr,
            nameEn: crit.nameEn,
            configuredWeight,
            effectiveWeight: configuredWeight,
            score: 100,
            isApplicable: true,
            details: [
              { labelAr: 'طلبات العمل عن بعد', labelEn: 'WFH Requests', value: 0 },
              { labelAr: 'حالة الالتزام', labelEn: 'Status', value: 'سجل ملتزم بالعمل الحضوري الكامل' }
            ],
            summaryNoteAr: 'لم يطلب الموظف أيام عمل عن بعد، مع التزام كامل بالعمل المكتبي.',
            summaryNoteEn: 'No WFH requests submitted, standard on-site attendance maintained.'
          });
        } else {
          const approvedWfh = empWfh.filter(w => w.status === 'Approved').length + empWfhFromLeaves.filter(l => l.status === 'Approved').length;
          const wfhScore = Math.round((approvedWfh / combinedWfhCount) * 100);

          criteriaResults.push({
            criterionId: crit.id,
            criterionKey: 'wfh',
            nameAr: crit.nameAr,
            nameEn: crit.nameEn,
            configuredWeight,
            effectiveWeight: configuredWeight,
            score: wfhScore,
            isApplicable: true,
            details: [
              { labelAr: 'إجمالي طلبات العمل عن بعد', labelEn: 'Total WFH Requests', value: combinedWfhCount },
              { labelAr: 'الطلبات المعتمدة', labelEn: 'Approved WFH', value: approvedWfh },
              { labelAr: 'نسبة الالتزام بالعمل عن بعد', labelEn: 'WFH Compliance', value: `${wfhScore}%` }
            ],
            summaryNoteAr: `نسبة اعتماد طلبات العمل عن بعد بلغت ${wfhScore}%.`,
            summaryNoteEn: `WFH compliance rate achieved at ${wfhScore}%.`
          });
        }
        break;
      }

      case 'investigations': {
        const empInvestigations = investigations.filter(inv => 
          isEmployeeMatch(inv.employeeId, employee) ||
          (Array.isArray(inv.employeeIds) && inv.employeeIds.some(id => isEmployeeMatch(id, employee)))
        );

        const activeOrCompleted = empInvestigations.filter(i => i.status !== 'Cancelled');
        let invScore = 100;

        if (activeOrCompleted.length > 0) {
          activeOrCompleted.forEach(inv => {
            if (inv.status === 'Completed') {
              invScore -= 25; // Proven or resolved investigation
            } else {
              invScore -= 10; // Ongoing or scheduled
            }
          });
        }
        invScore = Math.max(0, invScore);

        criteriaResults.push({
          criterionId: crit.id,
          criterionKey: 'investigations',
          nameAr: crit.nameAr,
          nameEn: crit.nameEn,
          configuredWeight,
          effectiveWeight: configuredWeight,
          score: invScore,
          isApplicable: true,
          details: [
            { labelAr: 'إجمالي التحقيقات الإدارية', labelEn: 'Total Investigations', value: activeOrCompleted.length },
            { labelAr: 'حالة السجل الإداري', labelEn: 'Record Status', value: activeOrCompleted.length === 0 ? 'سجل نظيف خالٍ من أي تحقيقات (100%)' : `توجد (${activeOrCompleted.length}) تحقيقات مسجلة` },
            { labelAr: 'درجة تقييم السجل الإداري', labelEn: 'Record Score', value: `${invScore}%` }
          ],
          summaryNoteAr: activeOrCompleted.length === 0 
            ? 'سجل نظيف تماماً وخالٍ من أية تحقيقات إدارية.' 
            : `توجد ${activeOrCompleted.length} وقائع تحقيق إداري مقيدة بالملف.`,
          summaryNoteEn: activeOrCompleted.length === 0 
            ? 'Pristine administrative record with zero investigations.' 
            : `Recorded ${activeOrCompleted.length} administrative investigations.`
        });
        break;
      }

      case 'penalties': {
        const empPenalties = penalties.filter(p => 
          isEmployeeMatch(p.employeeId, employee) &&
          p.status !== 'Cancelled' && 
          p.status !== 'Draft' && 
          p.status !== 'Rejected'
        );

        let penScore = 100;
        empPenalties.forEach(p => {
          if (p.penaltyType === 'Final Warning') {
            penScore -= 25;
          } else if (p.penaltyType === 'Warning') {
            penScore -= 12;
          } else if (p.deductionType === 'Days' || p.penaltyType === 'Day Deduction') {
            penScore -= 15 + (Number(p.deductionValue) || 1) * 8;
          } else if (p.deductionType === 'Amount' || p.penaltyType === 'Amount Deduction') {
            penScore -= 15;
          } else {
            penScore -= 10;
          }
        });
        penScore = Math.max(0, penScore);

        criteriaResults.push({
          criterionId: crit.id,
          criterionKey: 'penalties',
          nameAr: crit.nameAr,
          nameEn: crit.nameEn,
          configuredWeight,
          effectiveWeight: configuredWeight,
          score: penScore,
          isApplicable: true,
          details: [
            { labelAr: 'إجمالي الجزاءات التأديبية المسجلة', labelEn: 'Active Penalties', value: empPenalties.length },
            { labelAr: 'حالة الانضباط السلوكي', labelEn: 'Disciplinary Status', value: empPenalties.length === 0 ? 'سجل انضباطي مثالي خالٍ من أي جزاءات' : `تم تسجيل (${empPenalties.length}) جزاءات سارية` },
            { labelAr: 'درجة تقييم الانضباط', labelEn: 'Discipline Score', value: `${penScore}%` }
          ],
          summaryNoteAr: empPenalties.length === 0 
            ? 'سجل انضباطي مثالي خالٍ من أية عقوبات أو جزاءات.' 
            : `تم رصد ${empPenalties.length} جزاءات إدارية مؤثرة على التقييم.`,
          summaryNoteEn: empPenalties.length === 0 
            ? 'Exemplary disciplinary record with no active penalties.' 
            : `Recorded ${empPenalties.length} active penalties impacting appraisal.`
        });
        break;
      }

      default: {
        // Custom qualitative or behavioral criterion: defaults to full 100% baseline
        criteriaResults.push({
          criterionId: crit.id,
          criterionKey: 'custom',
          nameAr: crit.nameAr,
          nameEn: crit.nameEn,
          configuredWeight,
          effectiveWeight: configuredWeight,
          score: 100,
          isApplicable: true,
          details: [
            { labelAr: 'نوع المعيار', labelEn: 'Criterion Type', value: crit.responseType || 'سلوكي/نوعي' },
            { labelAr: 'الوزن النسبي المخصص', labelEn: 'Configured Weight', value: `${configuredWeight}%` }
          ],
          summaryNoteAr: 'معيار تقييمي فني/سلوكي خاضع لتقدير المشرف المباشر.',
          summaryNoteEn: 'Behavioral/qualitative criterion evaluated by direct manager.'
        });
        break;
      }
    }
  }

  // CALCULATE OVERALL SCORE WITH DYNAMIC NORMALIZATION
  // Total applicable weight
  const applicableCriteria = criteriaResults.filter(c => c.isApplicable);
  const totalConfiguredWeight = criteriaResults.reduce((sum, c) => sum + c.configuredWeight, 0);
  const totalApplicableWeight = applicableCriteria.reduce((sum, c) => sum + c.configuredWeight, 0);

  let overallScore = 0;
  if (totalApplicableWeight > 0) {
    let weightedSum = 0;
    applicableCriteria.forEach(c => {
      // Dynamic effective weight normalized to 100%
      const effectiveRatio = c.configuredWeight / totalApplicableWeight;
      c.effectiveWeight = Math.round(effectiveRatio * 100 * 10) / 10;
      weightedSum += c.score * effectiveRatio;
    });
    overallScore = Math.min(100, Math.max(0, Math.round(weightedSum * 10) / 10));
  } else {
    overallScore = 100;
  }

  const finalGrade = getPerformanceGrade(overallScore);

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    overallScore,
    systemSuggestedPercentage: overallScore,
    finalGrade,
    totalConfiguredWeight,
    totalApplicableWeight,
    criteriaResults,
    calculatedAt: new Date().toISOString()
  };
}
