import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Printer, 
  Building2, 
  Calendar, 
  UserCheck, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Briefcase, 
  Shield, 
  Sparkles, 
  FileSpreadsheet,
  CheckSquare
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Employee, ProjectTask, SystemSettings } from '../../types';

interface WeeklySchedulePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekDetails: {
    days: Array<{
      key: string;
      name: string;
      dateFormatted: string;
      isoDate: string;
      dayDate: Date;
    }>;
    sunday: Date;
    thursday: Date;
    sundayIso: string;
    rangeText: string;
  };
  employees: Employee[];
  weeklyEmployeesByDept: Map<string, Employee[]>;
  weeklyEmployeesInView: Employee[];
  weeklyScheduleDept: string;
  isExecutive: boolean;
  weeklyStore: Record<string, any>;
  getManagerAssignedTasks: (emp: Employee) => ProjectTask[];
  getCompletedDayTasksObjects: (emp: Employee, dayKey: string, isoDate: string, entry: any) => any[];
  getEmpDepartmentName: (emp: Employee) => string;
  systemSettings: SystemSettings | null;
  currentUserName: string;
}

export const WeeklySchedulePdfModal: React.FC<WeeklySchedulePdfModalProps> = ({
  isOpen,
  onClose,
  weekDetails,
  weeklyEmployeesByDept,
  weeklyEmployeesInView,
  weeklyScheduleDept,
  isExecutive,
  weeklyStore,
  getManagerAssignedTasks,
  getCompletedDayTasksObjects,
  getEmpDepartmentName,
  systemSettings,
  currentUserName,
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!isOpen) return null;

  const orgName = systemSettings?.organizationName || 'شركة الأفق الرقمي للتجارة والتقنية';
  const logoUrl = systemSettings?.logoUrl || '';

  // KPI Calculations for the PDF
  const totalEmployeesCount = weeklyEmployeesInView.length;
  let totalManagerTasksCount = 0;
  let totalCompletedTasksCount = 0;
  let totalProgressSum = 0;

  weeklyEmployeesInView.forEach(emp => {
    const storeKey = `${emp.id}_${weekDetails.sundayIso}`;
    const entry = weeklyStore[storeKey];
    const mTasks = getManagerAssignedTasks(emp);
    totalManagerTasksCount += mTasks.length;
    totalProgressSum += (entry?.progress || 0);

    weekDetails.days.forEach(d => {
      const cTasks = getCompletedDayTasksObjects(emp, d.key, d.isoDate, entry);
      totalCompletedTasksCount += cTasks.length;
    });
  });

  const avgCompletionRate = totalEmployeesCount > 0 
    ? Math.round(totalProgressSum / totalEmployeesCount) 
    : 0;

  const handleDownloadPdf = async () => {
    const element = document.getElementById('weekly-schedule-printable-document');
    if (!element) return;

    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Precise color conversions for oklab/oklch compatibility
          const oklabToRgb = (L: number, a_val: number, b_val: number, alpha?: number) => {
            const l = L;
            const l_ = l + 0.3963377774 * a_val + 0.2158037573 * b_val;
            const m_ = l - 0.1055613458 * a_val - 0.0638541128 * b_val;
            const s_ = l - 0.0894841775 * a_val - 1.2914855414 * b_val;

            const l3 = l_ * l_ * l_;
            const m3 = m_ * m_ * m_;
            const s3 = s_ * s_ * s_;

            const rLinear = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
            const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
            const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

            const toSRGB = (c: number) => {
              if (isNaN(c)) return 0;
              return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
            };

            const r = Math.min(255, Math.max(0, Math.round(toSRGB(rLinear) * 255)));
            const g = Math.min(255, Math.max(0, Math.round(toSRGB(gLinear) * 255)));
            const b = Math.min(255, Math.max(0, Math.round(toSRGB(bLinear) * 255)));

            return alpha !== undefined ? `rgba(${r}, ${g}, ${b}, ${alpha})` : `rgb(${r}, ${g}, ${b})`;
          };

          const oklchToRgb = (L: number, C: number, H: number, alpha?: number) => {
            const a_val = C * Math.cos((H * Math.PI) / 180);
            const b_val = C * Math.sin((H * Math.PI) / 180);
            return oklabToRgb(L, a_val, b_val, alpha);
          };

          const convertColorsText = (text: string): string => {
            if (!text) return text;
            let result = text;
            const oklchRegex = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/gi;
            result = result.replace(oklchRegex, (_match, lStr, cStr, hStr, aStr) => {
              const L = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
              const C = parseFloat(cStr);
              const H = parseFloat(hStr);
              let alpha: number | undefined = undefined;
              if (aStr) alpha = aStr.endsWith('%') ? parseFloat(aStr) / 100 : parseFloat(aStr);
              return oklchToRgb(L, C, H, alpha);
            });
            const oklabRegex = /oklab\(\s*([\d.]+%?)\s+([\d.-]+)\s+([\d.-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/gi;
            result = result.replace(oklabRegex, (_match, lStr, aStr, bStr, alphaStr) => {
              const L = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);
              const a_val = parseFloat(aStr);
              const b_val = parseFloat(bStr);
              let alpha: number | undefined = undefined;
              if (alphaStr) alpha = alphaStr.endsWith('%') ? parseFloat(alphaStr) / 100 : parseFloat(alphaStr);
              return oklabToRgb(L, a_val, b_val, alpha);
            });
            return result;
          };

          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el) => {
            if (el instanceof HTMLElement || el instanceof SVGElement) {
              const computed = window.getComputedStyle(el);
              const bg = computed.backgroundColor;
              if (bg && (bg.toLowerCase().includes('oklch') || bg.toLowerCase().includes('oklab'))) {
                el.style.backgroundColor = convertColorsText(bg);
              }
              const fg = computed.color;
              if (fg && (fg.toLowerCase().includes('oklch') || fg.toLowerCase().includes('oklab'))) {
                el.style.color = convertColorsText(fg);
              }
            }
          });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      // A4 Landscape format: 297mm width, 210mm height
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      
      const pageWidth = 297;
      const pageHeight = 210;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      const safeDept = weeklyScheduleDept === 'all' ? 'جميع-الإدارات' : weeklyScheduleDept.replace(/\s+/g, '-');
      const filename = `جدول-المهام-الأسبوعي-${safeDept}-${weekDetails.sundayIso}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-2 sm:p-4 bg-background/85 backdrop-blur-md overflow-y-auto" dir="rtl">
      <div 
        className="bg-card border-2 border-primary/40 shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* MODAL CONTROL HEADER */}
        <div className="bg-primary/10 border-b border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-black shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">
                معاينة وتحميل جدول المهام الأسبوعي (PDF رسمي معتمد)
              </h2>
              <p className="text-xs text-muted-foreground font-semibold">
                منسق ومُهيأ للطباعة والتصدير بكافة تفاصيل المهام وشعار واسم المنشأة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-background hover:bg-muted text-foreground border border-border text-xs font-black rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="طباعة المستند مباشرة"
            >
              <Printer className="w-4 h-4 text-primary" />
              <span>طباعة المستند</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'جاري إنشاء وتجهيز الـ PDF...' : 'تنزيل PDF فوري'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT AREA */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-muted/20">
          <div 
            id="weekly-schedule-printable-document"
            className="bg-white text-slate-900 p-6 sm:p-8 rounded-lg shadow-md border border-slate-200 min-w-[960px] mx-auto space-y-6"
            style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Arabic", sans-serif' }}
          >
            {/* DOCUMENT HEADER: LOGO, ORG NAME, REPORT TITLE */}
            <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4">
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt="Company Logo" 
                    className="h-16 w-auto max-w-[160px] object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-md border border-slate-700">
                    <Building2 className="w-8 h-8 text-amber-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                    {orgName}
                  </h1>
                  <p className="text-xs font-bold text-slate-600">
                    نظام إدارة الموارد والعمليات التشغيلية الذكية
                  </p>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    تقرير إدارة الفريق ومتابعة التكليفات الأسبوعية
                  </p>
                </div>
              </div>

              {/* REPORT METADATA BADGE */}
              <div className="text-left space-y-1 text-xs">
                <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded font-black text-xs">
                  جدول المهام الأسبوعي
                </div>
                <div className="text-slate-700 font-bold">
                  الأسبوع: <span className="font-mono">{weekDetails.rangeText}</span>
                </div>
                <div className="text-slate-600 font-semibold">
                  الإدارة: <strong className="text-slate-900">{weeklyScheduleDept === 'all' ? 'جميع الإدارات والمجموعات' : weeklyScheduleDept}</strong>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  تاريخ التصدير: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* KPI STATS SUMMARY CARDS */}
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 border border-slate-300 p-3 rounded text-center space-y-0.5">
                <div className="text-slate-500 font-bold text-[11px]">إجمالي الموظفين</div>
                <div className="text-lg font-black text-slate-900 font-mono">{totalEmployeesCount}</div>
              </div>
              <div className="bg-slate-50 border border-slate-300 p-3 rounded text-center space-y-0.5">
                <div className="text-slate-500 font-bold text-[11px]">المهام الرئيسية المسندة</div>
                <div className="text-lg font-black text-slate-900 font-mono">{totalManagerTasksCount}</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-300 p-3 rounded text-center space-y-0.5">
                <div className="text-emerald-700 font-bold text-[11px]">المهام المنجزة خلال الأسبوع</div>
                <div className="text-lg font-black text-emerald-800 font-mono">{totalCompletedTasksCount}</div>
              </div>
              <div className="bg-blue-50 border border-blue-300 p-3 rounded text-center space-y-0.5">
                <div className="text-blue-700 font-bold text-[11px]">متوسط نسبة الإنجاز العام</div>
                <div className="text-lg font-black text-blue-800 font-mono">{avgCompletionRate}%</div>
              </div>
            </div>

            {/* FULL DETAILED TABLE */}
            <div className="border border-slate-300 rounded overflow-hidden">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-800 text-white font-black text-[11px]">
                    <th className="p-2 border border-slate-700 text-center w-8">#</th>
                    <th className="p-2 border border-slate-700 min-w-[130px]">الموظف والوظيفة</th>
                    <th className="p-2 border border-slate-700 min-w-[180px]">المهام الرئيسية المسندة من المدير</th>
                    {weekDetails.days.map(d => (
                      <th key={d.key} className="p-2 border border-slate-700 text-center min-w-[110px]">
                        <div>{d.name}</div>
                        <div className="text-[9px] text-slate-300 font-mono">{d.dateFormatted}</div>
                      </th>
                    ))}
                    <th className="p-2 border border-slate-700 min-w-[130px]">المتابعة ونسبة الإنجاز</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-300">
                  {weeklyScheduleDept === 'all' && isExecutive ? (
                    // Grouped by Department
                    Array.from(weeklyEmployeesByDept.entries()).map(([deptName, deptEmployees]) => (
                      <React.Fragment key={deptName}>
                        <tr className="bg-slate-100 border-y-2 border-slate-400">
                          <td colSpan={9} className="p-2 font-black text-slate-900 text-xs">
                            🏢 إدارة / قسم: {deptName} ({deptEmployees.length} موظفاً)
                          </td>
                        </tr>
                        {deptEmployees.map((emp, idx) => {
                          const storeKey = `${emp.id}_${weekDetails.sundayIso}`;
                          const entry = weeklyStore[storeKey];
                          const managerTasks = getManagerAssignedTasks(emp);

                          return (
                            <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors align-top">
                              <td className="p-2 border border-slate-300 text-center font-bold text-slate-600 font-mono">{idx + 1}</td>
                              
                              {/* Employee Details */}
                              <td className="p-2 border border-slate-300">
                                <div className="font-black text-slate-900 text-xs">{emp.name}</div>
                                <div className="text-[10px] text-slate-600 font-semibold">{(emp as any).jobTitle || getEmpDepartmentName(emp)}</div>
                                <div className="text-[9px] text-slate-500 font-mono mt-0.5">كود: {emp.employeeId || '---'}</div>
                              </td>

                              {/* Manager Tasks */}
                              <td className="p-2 border border-slate-300 space-y-1.5">
                                {managerTasks.length > 0 ? (
                                  managerTasks.map(t => {
                                    const isTDone = t.status === 'Executed' || (t.status as string) === 'Completed' || t.status === 'Approved';
                                    return (
                                      <div key={t.id} className={`p-1.5 rounded border text-[10px] leading-tight space-y-0.5 ${
                                        isTDone ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-300 text-slate-900'
                                      }`}>
                                        <div className="font-bold flex items-start gap-1">
                                          <span>{isTDone ? '✔' : '⏳'}</span>
                                          <span>{t.title}</span>
                                        </div>
                                        <div className="text-[8px] text-slate-600 flex items-center justify-between font-semibold">
                                          <span>الأولوية: {t.priority || 'Medium'}</span>
                                          <span>{isTDone ? 'مكتملة' : 'قيد التنفيذ'}</span>
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-[10px] text-slate-500 font-medium italic">
                                    {entry?.mainTask || 'لا توجد مهام رئيسية مسندة'}
                                  </div>
                                )}
                              </td>

                              {/* 5 Days Columns */}
                              {weekDetails.days.map(d => {
                                const completedTasks = getCompletedDayTasksObjects(emp, d.key, d.isoDate, entry);
                                return (
                                  <td key={d.key} className="p-1.5 border border-slate-300 text-[10px] space-y-1">
                                    {completedTasks.length > 0 ? (
                                      completedTasks.map((ct: any) => (
                                        <div key={ct.id} className="p-1 bg-emerald-50 border border-emerald-200 rounded text-slate-900 text-[9px] leading-snug space-y-0.5">
                                          <div className="font-bold text-emerald-900 flex items-start gap-1">
                                            <span>✔</span>
                                            <span>{ct.title}</span>
                                          </div>
                                          {ct.completionTimeFormatted && (
                                            <div className="text-[8px] text-slate-600 font-mono">
                                              ⏰ {ct.completionTimeFormatted}
                                            </div>
                                          )}
                                          {ct.estimatedHours && (
                                            <div className="text-[8px] text-slate-600 font-mono">
                                              ⏳ {ct.estimatedHours} س
                                            </div>
                                          )}
                                          {ct.delayInfo?.isDelayed && (
                                            <div className="text-[8px] text-rose-700 font-bold">
                                              ⚠️ تأخير: {ct.delayInfo.delayHours} س
                                            </div>
                                          )}
                                          {ct.projectName && (
                                            <div className="text-[8px] text-slate-500 truncate">
                                              📁 {ct.projectName}
                                            </div>
                                          )}
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-center py-2 text-slate-300 text-xs font-bold">—</div>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Progress & Follow Up */}
                              <td className="p-2 border border-slate-300 space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-black">
                                  <span className="text-slate-600">نسبة الإنجاز:</span>
                                  <span className="text-blue-700 font-mono">{entry?.progress || 0}%</span>
                                </div>
                                <div className="w-full bg-slate-200 h-1.5 rounded overflow-hidden">
                                  <div 
                                    className="bg-blue-600 h-full rounded"
                                    style={{ width: `${entry?.progress || 0}%` }}
                                  />
                                </div>
                                <div className="text-[9px] text-slate-700 bg-slate-50 p-1 rounded border border-slate-200 leading-tight">
                                  {entry?.followUp || 'لا توجد ملاحظات متابعة.'}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  ) : (
                    // Single Department or Manager Team
                    weeklyEmployeesInView.map((emp, idx) => {
                      const storeKey = `${emp.id}_${weekDetails.sundayIso}`;
                      const entry = weeklyStore[storeKey];
                      const managerTasks = getManagerAssignedTasks(emp);

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors align-top">
                          <td className="p-2 border border-slate-300 text-center font-bold text-slate-600 font-mono">{idx + 1}</td>
                          
                          {/* Employee Details */}
                          <td className="p-2 border border-slate-300">
                            <div className="font-black text-slate-900 text-xs">{emp.name}</div>
                            <div className="text-[10px] text-slate-600 font-semibold">{(emp as any).jobTitle || getEmpDepartmentName(emp)}</div>
                            <div className="text-[9px] text-slate-500 font-mono mt-0.5">كود: {emp.employeeId || '---'}</div>
                          </td>

                          {/* Manager Tasks */}
                          <td className="p-2 border border-slate-300 space-y-1.5">
                            {managerTasks.length > 0 ? (
                              managerTasks.map(t => {
                                const isTDone = t.status === 'Executed' || (t.status as string) === 'Completed' || t.status === 'Approved';
                                return (
                                  <div key={t.id} className={`p-1.5 rounded border text-[10px] leading-tight space-y-0.5 ${
                                    isTDone ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-300 text-slate-900'
                                  }`}>
                                    <div className="font-bold flex items-start gap-1">
                                      <span>{isTDone ? '✔' : '⏳'}</span>
                                      <span>{t.title}</span>
                                    </div>
                                    <div className="text-[8px] text-slate-600 flex items-center justify-between font-semibold">
                                      <span>الأولوية: {t.priority || 'Medium'}</span>
                                      <span>{isTDone ? 'مكتملة' : 'قيد التنفيذ'}</span>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-[10px] text-slate-500 font-medium italic">
                                {entry?.mainTask || 'لا توجد مهام رئيسية مسندة'}
                              </div>
                            )}
                          </td>

                          {/* 5 Days Columns */}
                          {weekDetails.days.map(d => {
                            const completedTasks = getCompletedDayTasksObjects(emp, d.key, d.isoDate, entry);
                            return (
                              <td key={d.key} className="p-1.5 border border-slate-300 text-[10px] space-y-1">
                                {completedTasks.length > 0 ? (
                                  completedTasks.map((ct: any) => (
                                    <div key={ct.id} className="p-1 bg-emerald-50 border border-emerald-200 rounded text-slate-900 text-[9px] leading-snug space-y-0.5">
                                      <div className="font-bold text-emerald-900 flex items-start gap-1">
                                        <span>✔</span>
                                        <span>{ct.title}</span>
                                      </div>
                                      {ct.completionTimeFormatted && (
                                        <div className="text-[8px] text-slate-600 font-mono">
                                          ⏰ {ct.completionTimeFormatted}
                                        </div>
                                      )}
                                      {ct.estimatedHours && (
                                        <div className="text-[8px] text-slate-600 font-mono">
                                          ⏳ {ct.estimatedHours} س
                                        </div>
                                      )}
                                      {ct.delayInfo?.isDelayed && (
                                        <div className="text-[8px] text-rose-700 font-bold">
                                          ⚠️ تأخير: {ct.delayInfo.delayHours} س
                                        </div>
                                      )}
                                      {ct.projectName && (
                                        <div className="text-[8px] text-slate-500 truncate">
                                          📁 {ct.projectName}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-2 text-slate-300 text-xs font-bold">—</div>
                                )}
                              </td>
                            );
                          })}

                          {/* Progress & Follow Up */}
                          <td className="p-2 border border-slate-300 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-black">
                              <span className="text-slate-600">نسبة الإنجاز:</span>
                              <span className="text-blue-700 font-mono">{entry?.progress || 0}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded overflow-hidden">
                              <div 
                                className="bg-blue-600 h-full rounded"
                                style={{ width: `${entry?.progress || 0}%` }}
                              />
                            </div>
                            <div className="text-[9px] text-slate-700 bg-slate-50 p-1 rounded border border-slate-200 leading-tight">
                              {entry?.followUp || 'لا توجد ملاحظات متابعة.'}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* DOCUMENT FOOTER & SIGNATURES */}
            <div className="border-t border-slate-300 pt-4 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 font-semibold gap-2">
              <div>
                <span>المسؤول المباشر / المستخرج: </span>
                <strong className="text-slate-800">{currentUserName}</strong>
              </div>
              <div className="text-center text-[10px] text-slate-400">
                مستند إداري سري - تم استخراجه آلياً عبر نظام إدارة المؤسسة
              </div>
              <div className="text-left font-mono">
                صفحة 1 من 1
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
