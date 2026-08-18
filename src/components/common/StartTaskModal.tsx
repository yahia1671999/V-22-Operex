import React, { useState, useMemo } from 'react';
import { Play, Clock, Calendar, AlertCircle, CheckCircle2, X, Sparkles, User, FileText } from 'lucide-react';
import { ProjectTask, WorkflowLog } from '../../types';
import { useAuth } from '../../AuthContext';
import { useData } from '../../contexts/DataContext';
import { db, doc, updateDoc, arrayUnion } from '../../api';
import { isManagerAssignedTask } from '../../lib/taskUtils';

interface StartTaskModalProps {
  task: ProjectTask | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StartTaskModal: React.FC<StartTaskModalProps> = ({
  task,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, profile, isAdmin } = useAuth();
  const { refreshData, projects } = useData();

  const isManagerOrAdmin = useMemo(() => {
    const roleStr = String((profile as any)?.role || (user as any)?.role || '').toLowerCase();
    return isAdmin || roleStr.includes('admin') || roleStr.includes('manager') || roleStr.includes('مدير') || roleStr.includes('general');
  }, [isAdmin, profile, user]);

  const isAssignedByManager = useMemo(() => {
    return isManagerAssignedTask(
      task,
      (profile as any)?.employeeId || profile?.id || user?.uid,
      user?.email,
      isManagerOrAdmin
    );
  }, [task, profile, user, isManagerOrAdmin]);

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => now.toISOString().split('T')[0], [now]);
  const currentTimeStr = useMemo(() => {
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }, [now]);

  const [startDate, setStartDate] = useState<string>(todayStr);
  const [startTime, setStartTime] = useState<string>(currentTimeStr);
  const [estimatedHours, setEstimatedHours] = useState<number>(() => {
    return task?.estimatedHours ? Number(task.estimatedHours) : 2;
  });
  const [startNotes, setStartNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state when task changes
  React.useEffect(() => {
    if (task) {
      setStartDate(task.actualStartDate || task.startDate || todayStr);
      setStartTime(task.actualStartTime || currentTimeStr);
      setEstimatedHours(task.estimatedHours ? Number(task.estimatedHours) : 2);
      setStartNotes('');
    }
  }, [task, todayStr, currentTimeStr]);

  if (!isOpen || !task) return null;

  const projectObj = task.projectId ? projects.find(p => p.id === task.projectId) : null;

  // Calculate expected completion timestamp and formatted string
  const expectedEnd = (() => {
    if (!startDate || !startTime || !estimatedHours) return null;
    const startDt = new Date(`${startDate}T${startTime}:00`);
    if (isNaN(startDt.getTime())) return null;
    const endDt = new Date(startDt.getTime() + Number(estimatedHours) * 60 * 60 * 1000);
    
    const isSameDay = endDt.toISOString().split('T')[0] === startDate;
    const timeFormatted = endDt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const dateFormatted = endDt.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' });

    return {
      date: endDt,
      timeFormatted,
      dateFormatted,
      isSameDay,
      displayText: isSameDay 
        ? `اليوم في تمام الساعة ${timeFormatted}` 
        : `${dateFormatted} - الساعة ${timeFormatted}`
    };
  })();

  const handleStartTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;

    setIsSubmitting(true);
    try {
      const startDateTimeIso = new Date(`${startDate}T${startTime}:00`).toISOString();
      const currentUserName = profile?.name || user?.displayName || user?.email || 'الموظف';
      const currentUserId = user?.uid || profile?.id || 'emp';

      const log: WorkflowLog = {
        fromStatus: task.status,
        toStatus: 'In Progress',
        userId: currentUserId,
        userName: currentUserName,
        timestamp: new Date().toISOString(),
        note: `قام الموظف ببدء العمل على المهمة بتاريخ ${startDate} ووقت ${startTime}. ${startNotes ? `ملاحظات: ${startNotes}` : ''}`
      };

      const updatedPayload: any = {
        status: 'In Progress',
        startDate: startDate,
        actualStartDate: startDate,
        actualStartTime: startTime,
        startedAt: startDateTimeIso,
        estimatedHours: isAssignedByManager ? (Number(task.estimatedHours) || Number(estimatedHours) || 0) : (Number(estimatedHours) || 0),
        workflowLog: Array.isArray(task.workflowLog) ? [...task.workflowLog, log] : [log],
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'projectTasks', task.id), updatedPayload);
      if (typeof refreshData === 'function') {
        await refreshData();
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Error starting task:', err);
      alert('حدث خطأ أثناء حفظ بدء المهمة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-card border-2 border-primary w-full max-w-lg p-6 space-y-5 shadow-2xl relative text-right rounded-2xl" dir="rtl">
        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-4 left-4 p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-3 bg-primary/10 text-primary border border-primary/20 rounded-2xl shrink-0">
            <Play className="w-6 h-6 fill-current" />
          </div>
          <div className="space-y-1 overflow-hidden pr-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full">
                بدء تنفيذ المهمة
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

        {/* Form */}
        <form onSubmit={handleStartTask} className="space-y-4 text-xs font-bold">
          {/* Start Date & Time Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-3.5 border border-border rounded-xl">
            <div>
              <label className="block mb-1.5 text-foreground font-black flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>تاريخ بدء العمل:</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full p-2.5 bg-background border border-border rounded-lg font-bold text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                required
              />
            </div>

            <div>
              <label className="block mb-1.5 text-foreground font-black flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>وقت البدء (ساعة : دقيقة):</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full p-2.5 bg-background border border-border rounded-lg font-bold text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                required
              />
            </div>
          </div>

          {/* Estimated Time (الاستميت تايم) */}
          <div className="bg-primary/5 border border-primary/20 p-3.5 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-primary font-black flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>الوقت التقديري المقدر لإنجاز المهمة (Estimated Time):</span>
              </label>
              <span className="text-primary font-black text-xs font-mono">
                {estimatedHours} {estimatedHours === 1 ? 'ساعة' : estimatedHours === 2 ? 'ساعتان' : 'ساعات'}
              </span>
            </div>

            {isAssignedByManager ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-black text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>الوقت التقديري معتمد ومحدد من قِبل المدير ({estimatedHours} ساعة)</span>
                </div>
                <p className="text-[11px] text-muted-foreground pr-5">
                  🔒 وفقاً لسياسة العمل، لا يمكن للموظف تعديل الوقت التقديري للمهام المسندة من المدير المباشر.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[1, 2, 4, 8].map(h => (
                    <button
                      type="button"
                      key={h}
                      onClick={() => setEstimatedHours(h)}
                      className={`py-1.5 text-center text-xs font-black rounded-lg border transition-all cursor-pointer ${
                        estimatedHours === h
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-background text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {h} {h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : 'ساعات'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">أو حدد بالساعات:</span>
                  <input
                    type="number"
                    min="0.25"
                    max="200"
                    step="0.25"
                    value={estimatedHours}
                    onChange={e => setEstimatedHours(parseFloat(e.target.value) || 0)}
                    className="w-24 p-1.5 bg-background border border-border rounded-lg text-xs font-mono font-bold text-foreground text-center outline-none focus:border-primary"
                    required
                  />
                  <span className="text-[11px] text-muted-foreground">ساعة عمل</span>
                </div>
              </>
            )}
          </div>

          {/* Live Expected Delivery Calculation */}
          {expectedEnd && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-black text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>موعد التسليم المتوقع والمستهدف:</span>
              </div>
              <p className="text-xs font-black text-foreground font-mono pr-5">
                {expectedEnd.displayText}
              </p>
              <p className="text-[10px] text-muted-foreground pr-5">
                * سيتم احتساب نسبة الإنجاز والتأخير تلقائياً بموجب هذا الموعد.
              </p>
            </div>
          )}

          {/* Notes / Plan */}
          <div>
            <label className="block mb-1 text-muted-foreground font-bold flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span>ملاحظات البدء أو خطة التنفيذ (اختياري):</span>
            </label>
            <textarea
              value={startNotes}
              onChange={e => setStartNotes(e.target.value)}
              rows={2}
              placeholder="اكتب أي ملاحظة عن متطلبات البدء أو خطتك لإنجاز المهمة..."
              className="w-full p-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary font-medium text-xs text-foreground"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-muted text-muted-foreground border border-border rounded-xl font-bold cursor-pointer hover:bg-muted/80 transition-all text-xs"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-black rounded-xl hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 shadow-md flex items-center gap-2 text-xs"
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>تأكيد بدء تنفيذ المهمة</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
