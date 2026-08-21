import React, { useState, useMemo } from 'react';
import { CheckCircle2, Clock, Calendar, AlertCircle, X, Sparkles, FileText, Check, ArrowRight } from 'lucide-react';
import { ProjectTask, WorkflowLog } from '../../types';
import { useAuth } from '../../AuthContext';
import { useData } from '../../contexts/DataContext';
import { db, doc, updateDoc, arrayUnion } from '../../api';
import { formatDateTimeArabic, formatDurationArabic, getPlannedStartTime, getPlannedEndTime } from '../../lib/taskUtils';

interface CompleteTaskModalProps {
  task: ProjectTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CompleteTaskModal: React.FC<CompleteTaskModalProps> = ({
  task,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, profile } = useAuth();
  const { refreshData, projects, projectTasks } = useData();

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => now.toISOString().split('T')[0], [now]);
  const currentTimeStr = useMemo(() => {
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }, [now]);

  const [completionDate, setCompletionDate] = useState<string>(todayStr);
  const [completionTime, setCompletionTime] = useState<string>(currentTimeStr);
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state when task changes
  React.useEffect(() => {
    if (task) {
      setCompletionDate(todayStr);
      setCompletionTime(currentTimeStr);
      setCompletionNotes(task.completionNotes || '');
    }
  }, [task, todayStr, currentTimeStr]);

  if (!isOpen || !task) return null;

  const projectObj = task.projectId ? projects.find(p => p.id === task.projectId) : null;
  const estimatedHours = Number(task.estimatedHours) || 0;
  const plannedStartObj = getPlannedStartTime(task);
  const plannedEndObj = getPlannedEndTime(task);

  // Calculate live completion metrics
  // Rule: Delay is calculated ONLY when exceeding planned end time (plannedStart + estimatedHours).
  // If completed before or at planned end time, delay is 0. Assignment time (createdAt) is never used.
  const liveMetrics = (() => {
    if (!completionDate || !completionTime) return null;
    const compDateObj = new Date(`${completionDate}T${completionTime}:00`);
    if (isNaN(compDateObj.getTime())) return null;

    let actualMinutes = 0;
    let actualHours = 0;
    if (plannedStartObj && compDateObj.getTime() >= plannedStartObj.getTime()) {
      const diffMs = compDateObj.getTime() - plannedStartObj.getTime();
      actualMinutes = Math.round(diffMs / (1000 * 60));
      actualHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    }

    let isDelayed = false;
    let delayMinutes = 0;

    if (plannedEndObj) {
      if (compDateObj.getTime() > plannedEndObj.getTime()) {
        const diffMs = compDateObj.getTime() - plannedEndObj.getTime();
        delayMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
        isDelayed = delayMinutes > 0;
      }
    }

    const delayHours = Math.round((delayMinutes / 60) * 10) / 10;

    return {
      compDateObj,
      actualMinutes,
      actualHours,
      actualTimeFormatted: formatDurationArabic(actualMinutes),
      isDelayed,
      delayMinutes,
      delayHours,
      delayFormatted: isDelayed ? formatDurationArabic(delayMinutes) : 'في الوقت المحدد'
    };
  })();

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    // Check subtasks dependency
    const childTasks = projectTasks.filter(t => t.parentTaskId === task.id);
    const hasOpenChildren = childTasks.some(child => child.status !== 'Approved' && child.status !== 'Executed' && child.status !== 'Rejected');
    if (hasOpenChildren) {
      alert('لا يمكن إنهاء هذه المهمة بسبب وجود مهام فرعية لم يتم استكمالها بعد.');
      return;
    }

    setIsSubmitting(true);
    try {
      const completionDateTimeIso = new Date(`${completionDate}T${completionTime}:00`).toISOString();
      const currentUserName = profile?.name || user?.displayName || user?.email || 'الموظف';
      const currentUserId = user?.uid || profile?.id || 'emp';

      const delayNote = liveMetrics?.isDelayed
        ? ` (تأخير: ${liveMetrics.delayFormatted})`
        : ' (تم الإنجاز في الوقت المحدد)';

      const log: WorkflowLog = {
        fromStatus: task.status,
        toStatus: 'Executed',
        userId: currentUserId,
        userName: currentUserName,
        timestamp: new Date().toISOString(),
        note: `قام الموظف بإتمام المهمة بتاريخ ${completionDate} الساعة ${completionTime}. الوقت المستغرق: ${liveMetrics?.actualTimeFormatted || 'غير محدد'}${delayNote}.${completionNotes ? ` ملاحظات: ${completionNotes}` : ''}`
      };

      const updatedPayload: any = {
        status: 'Executed',
        completedAt: completionDateTimeIso,
        actualEndDate: completionDate,
        actualEndTime: completionTime,
        completionNotes: completionNotes || '',
        delayHours: liveMetrics?.delayHours || 0,
        isDelayed: !!liveMetrics?.isDelayed,
        workflowLog: Array.isArray(task.workflowLog) ? [...task.workflowLog, log] : [log],
        updatedAt: new Date().toISOString()
      };

      // If task didn't have startedAt set yet, set actualStartDate
      if (!task.actualStartDate && !task.startedAt) {
        updatedPayload.actualStartDate = completionDate;
        updatedPayload.actualStartTime = completionTime;
        updatedPayload.startedAt = completionDateTimeIso;
      }

      await updateDoc(doc(db, 'projectTasks', task.id), updatedPayload);
      if (typeof refreshData === 'function') {
        await refreshData();
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error completing task:', err);
      alert('حدث خطأ أثناء حفظ إتمام المهمة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-card border-2 border-emerald-500 w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl relative text-right rounded-2xl overflow-hidden my-auto" dir="rtl">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border flex items-start justify-between gap-3 relative shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-2xl shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1 overflow-hidden pr-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full">
                  إتمام وإنهاء المهمة
                </span>
                {projectObj ? (
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    📁 {projectObj.name}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    📌 تكليف مباشر
                  </span>
                )}
              </div>
              <h3 className="text-base font-black text-foreground line-clamp-1">{task.title}</h3>
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
              )}
            </div>
          </div>

          {/* Close Button */}
          <button 
            onClick={onClose} 
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 pt-4 flex-1 overflow-y-auto space-y-4">
          {/* Task Timeline Summary (وقت البدء المحدد والمدة التقديرية ووقت الانتهاء المخطط) */}
          <div className="grid grid-cols-3 gap-2 bg-muted/40 p-3 rounded-xl border border-border text-center text-xs font-bold">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block">وقت البدء المحدد:</span>
              <span className="text-primary font-black text-[11px] block">
                {plannedStartObj ? formatDateTimeArabic(plannedStartObj) : 'غير محدد'}
              </span>
            </div>
            <div className="space-y-1 border-x border-border/80">
              <span className="text-[10px] text-muted-foreground block">المدة التقديرية:</span>
              <span className="text-foreground font-black text-[11px] block">
                {estimatedHours > 0 ? `${estimatedHours} ساعة` : 'غير محدد'}
              </span>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground block">وقت الانتهاء المخطط:</span>
              <span className="text-foreground font-black text-[11px] block">
                {plannedEndObj ? formatDateTimeArabic(plannedEndObj) : 'غير محدد'}
              </span>
            </div>
          </div>

          {/* Form */}
          <form id="complete-task-form" onSubmit={handleCompleteTask} className="space-y-4 text-xs font-bold">
            {/* Completion Date & Time Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-3.5 border border-border rounded-xl">
              <div>
                <label className="block mb-1.5 text-foreground font-black flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تاريخ انتهاء التنفيذ:</span>
                </label>
                <input
                  type="date"
                  value={completionDate}
                  onChange={e => setCompletionDate(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border rounded-lg font-bold text-xs text-foreground outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="block mb-1.5 text-foreground font-black flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>وقت الانتهاء (ساعة : دقيقة):</span>
                </label>
                <input
                  type="time"
                  value={completionTime}
                  onChange={e => setCompletionTime(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border rounded-lg font-bold text-xs text-foreground outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  required
                />
              </div>
            </div>

            {/* Live Actual Time & Delay Breakdown Box */}
            {liveMetrics && (
              <div className={`p-3.5 rounded-xl border space-y-2 ${
                liveMetrics.isDelayed 
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300' 
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              }`}>
                <div className="flex items-center justify-between font-black text-xs">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>الوقت المستغرق من البدء:</span>
                  </span>
                  <span className="font-mono text-sm font-black">{liveMetrics.actualTimeFormatted}</span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                  <span className="font-bold">مؤشر التأخير عن الموعد المخطط:</span>
                  {liveMetrics.isDelayed ? (
                    <span className="font-black text-rose-600 dark:text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-md font-mono">
                      ⚠️ متأخرة بمقدار: {liveMetrics.delayFormatted}
                    </span>
                  ) : (
                    <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                      ✓ في الموعد المخطط (تأخير 0)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Completion Notes / Deliverables */}
            <div>
              <label className="block mb-1 text-muted-foreground font-bold flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span>ملاحظات الإنجاز أو مخرجات المهمة (اختياري):</span>
              </label>
              <textarea
                value={completionNotes}
                onChange={e => setCompletionNotes(e.target.value)}
                rows={2}
                placeholder="اكتب ملخصاً عما تم إنجازه أو روابط المخرجات..."
                className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-emerald-500 font-medium text-xs text-foreground"
              />
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-muted text-muted-foreground border border-border rounded-xl font-bold cursor-pointer hover:bg-muted/80 transition-all text-xs"
          >
            إلغاء
          </button>
          <button
            type="submit"
            form="complete-task-form"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-50 shadow-md flex items-center gap-2 text-xs"
          >
            {isSubmitting ? (
              <span>جاري حفظ الإتمام...</span>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>تأكيد إنهاء وإتمام المهمة</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
