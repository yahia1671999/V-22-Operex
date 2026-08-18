import React, { useEffect, useState, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X, AlertTriangle, Clock, Volume2, Calendar, ChevronDown, ChevronUp, Layers, CheckCircle } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../AuthContext';
import { TaskChatMessage, ProjectTask } from '../types';
import { isOpenTask, getTaskAssignedIds } from '../lib/taskUtils';
import { NoticeDisplayModal } from './common/NoticeDisplayModal';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
}

// Custom Web Audio API synthesizer chime functions for distinct notification types

// 1. Urgent Warning Alarm Tone for Overdue Tasks (Distinct saw/triangle pulse)
export const playOverdueAlertSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume();

    // Urgent pulse: A5 (880Hz), F5 (698.46Hz), A5 (880Hz) with triangle/saw blend
    const sequence = [
      { freq: 880.00, start: 0.00, duration: 0.15, type: 'triangle' as OscillatorType },
      { freq: 698.46, start: 0.18, duration: 0.15, type: 'triangle' as OscillatorType },
      { freq: 880.00, start: 0.36, duration: 0.25, type: 'triangle' as OscillatorType },
      { freq: 1046.50, start: 0.65, duration: 0.40, type: 'sine' as OscillatorType },
    ];

    sequence.forEach(({ freq, start, duration, type }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    });
  } catch (err) {
    console.error("Error playing overdue alert sound:", err);
  }
};

// 2. Harmonious Bell Chime for Tasks Due Today (Harmonic major chord C5 -> E5 -> G5 -> C6)
export const playTodayDueAlertSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume();

    const sequence = [
      { freq: 523.25, start: 0.00, duration: 0.15 }, // C5
      { freq: 659.25, start: 0.12, duration: 0.15 }, // E5
      { freq: 783.99, start: 0.24, duration: 0.20 }, // G5
      { freq: 1046.50, start: 0.38, duration: 0.45 }, // C6
    ];

    sequence.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + start);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + duration);
    });
  } catch (err) {
    console.error("Error playing today alert sound:", err);
  }
};

// 3. Gentle Ping Sound for Chat & Task Comments
export const playChatMentionAlertSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (err) {
    console.error("Error playing chat mention sound:", err);
  }
};

// Legacy fallback export
export const playTaskAlertSound = playTodayDueAlertSound;

export const GlobalNotifications: React.FC = () => {
  const { projects, projectTasks, administrativeNotices, employees = [], penalties = [] } = useData();
  const { user, profile, isAdmin, isHR } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const seenMessages = useRef<Set<string>>(new Set());
  const seenGrievances = useRef<Set<string>>(new Set());
  const initialLoadTime = useRef<number>(Date.now());

  const myEmpIdentifiers = useMemo(() => {
    return Array.from(new Set([
      profile?.id,
      (profile as any)?.employeeId,
      user?.uid,
      user?.email?.trim().toLowerCase()
    ].filter(Boolean))).map(id => String(id).trim().toLowerCase());
  }, [profile, user]);

  // Unread Administrative Notices
  const unreadAdminNotices = useMemo(() => {
    if (!Array.isArray(administrativeNotices)) return [];
    const myId = profile?.id || user?.uid || '';
    const myEmail = (user?.email || profile?.email || '').toLowerCase().trim();
    const myName = (profile?.name || (user as any)?.displayName || '').toLowerCase().trim();

    // Gather all identifiers for logged-in user
    const myIdentifiersSet = new Set<string>();
    if (profile?.id) myIdentifiersSet.add(String(profile.id).toLowerCase().trim());
    if ((profile as any)?.employeeId) myIdentifiersSet.add(String((profile as any).employeeId).toLowerCase().trim());
    if (user?.uid) myIdentifiersSet.add(String(user.uid).toLowerCase().trim());
    if (myEmail) myIdentifiersSet.add(myEmail);
    if (myName) myIdentifiersSet.add(myName);

    const myEmpObj = employees.find(e => 
      (e.email && e.email.toLowerCase().trim() === myEmail) ||
      e.id === profile?.id || e.userId === user?.uid || (profile as any)?.employeeId === e.employeeId
    );
    if (myEmpObj) {
      if (myEmpObj.id) myIdentifiersSet.add(String(myEmpObj.id).toLowerCase().trim());
      if (myEmpObj.employeeId) myIdentifiersSet.add(String(myEmpObj.employeeId).toLowerCase().trim());
      if (myEmpObj.userId) myIdentifiersSet.add(String(myEmpObj.userId).toLowerCase().trim());
      if (myEmpObj.email) myIdentifiersSet.add(String(myEmpObj.email).toLowerCase().trim());
      if (myEmpObj.name) myIdentifiersSet.add(String(myEmpObj.name).toLowerCase().trim());
    }

    const myIdentifiers = Array.from(myIdentifiersSet);

    return administrativeNotices.filter(n => {
      if (n.status !== 'Published') return false;
      const isRead = n.readBy && n.readBy.includes(myId);
      if (isRead) return false;

      const audience = n.targetAudience;
      const lowerAudience = Array.isArray(audience) ? audience.map(x => String(x).toLowerCase().trim()) : [];
      const titleLower = (n.title || '').toLowerCase();
      const isInvestigationOrPenalty = titleLower.includes('جلسة تحقيق') || titleLower.includes('تحقيق إداري') || titleLower.includes('جزاء') || titleLower.includes('مخالفة') || String(n.id).startsWith('NOTICE-PEN-') || (n.category as string) === 'investigation' || (n.category as string) === 'decision';

      if (isInvestigationOrPenalty) {
        // Direct match with target audience (employee / targeted manager)
        const isTarget = myIdentifiers.some(id => lowerAudience.includes(id));

        // Direct manager match: check if logged in user is direct manager of any employee in audience or matched manager identifiers
        const myMgrIdentifiers = [
          myEmpObj?.id,
          myEmpObj?.employeeId,
          myEmpObj?.userId,
          myEmpObj?.email,
          myEmpObj?.name,
          profile?.id,
          (profile as any)?.employeeId,
          user?.uid,
          user?.email,
          myName
        ].filter(Boolean).map(x => String(x).toLowerCase().trim());

        const isManagerTarget = lowerAudience.some(id => myMgrIdentifiers.includes(id));

        const isManagerForNotice = isManagerTarget || employees.some(e => {
          const eIds = [e.id, e.employeeId, e.userId, e.email, e.name].filter(Boolean).map(x => String(x).toLowerCase().trim());
          const isInNotice = eIds.some(id => lowerAudience.includes(id));
          if (!isInNotice) return false;
          const mId = String(e.managerId || e.directManagerId || '').toLowerCase().trim();
          return mId && myMgrIdentifiers.includes(mId);
        });

        // Show notice/badge for both employee and direct/higher manager
        if (isTarget || isManagerForNotice) return true;
        return false;
      } else {
        // 1) Creator check for general notices: Exclude author / creator from receiving their own published announcement
        const nCreatedById = String(n.createdById || n.publisherId || '').trim();
        const nCreatedByName = String(n.createdByName || n.createdBy || '').toLowerCase().trim();

        const isCreator = (nCreatedById && (nCreatedById === profile?.id || nCreatedById === user?.uid)) ||
          (nCreatedByName && myName && (nCreatedByName === myName || nCreatedByName === myEmail));

        if (isCreator) return false;

        if (lowerAudience.includes('all') || lowerAudience.length === 0) return true;
        const isForMe = myIdentifiers.some(id => lowerAudience.includes(id));
        return isForMe;
      }
    });
  }, [administrativeNotices, profile, user, employees]);

  const handleNavigateToNotices = () => {
    window.dispatchEvent(new CustomEvent('navigate_to_entity', {
      detail: { module: 'self_service', tab: 'admin_notices' }
    }));
  };

  // Task Deadlines State
  const [todayTasks, setTodayTasks] = useState<ProjectTask[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<ProjectTask[]>([]);
  const [isDeadlineBannerOpen, setIsDeadlineBannerOpen] = useState(false);
  const [isExpandedDetails, setIsExpandedDetails] = useState(false);
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);

  const userRole = profile?.role || 'User';

  // 1. Process Chat / Comment Notifications
  useEffect(() => {
    if (!user) return;

    let newNotifications: NotificationItem[] = [];

    const processMessages = (messages: TaskChatMessage[], titlePrefix: string, isTaskMessage: boolean) => {
      if (!Array.isArray(messages)) return;
      
      try {
        messages.forEach(msg => {
          if (msg && !seenMessages.current.has(msg.id)) {
            seenMessages.current.add(msg.id);

            const isRecent = new Date(msg.createdAt).getTime() > initialLoadTime.current - 10000;
            if (isRecent && msg.userId !== user.uid) {
              let shouldNotify = false;
              if (!isTaskMessage) {
                shouldNotify = true;
              } else if (isTaskMessage && myEmpIdentifiers.some(id => msg.mentions?.includes(id))) {
                shouldNotify = true;
              }

              if (shouldNotify) {
                newNotifications.push({
                  id: msg.id + Math.random().toString(),
                  title: titlePrefix + ' - ' + msg.userName,
                  message: msg.text,
                  timestamp: new Date()
                });
              }
            }
          }
        });
      } catch (err) {
        console.error("Error processing messages in GlobalNotifications:", err);
      }
    };

    if (Array.isArray(projects)) {
      projects.forEach(p => {
        if (p && p.chat && Array.isArray(p.chat)) {
          processMessages(p.chat, `مشروع: ${p.name}`, false);
        }
      });
    }

    if (Array.isArray(projectTasks)) {
      projectTasks.forEach(t => {
        if (t && t.comments && Array.isArray(t.comments)) {
          processMessages(t.comments, `مهمة: ${t.title}`, true);
        }
      });
    }

    if (newNotifications.length > 0) {
      setNotifications(prev => [...prev, ...newNotifications].slice(-5));
      try {
        playChatMentionAlertSound();
      } catch (err) {}
    }

  }, [projects, projectTasks, user, myEmpIdentifiers]);

  // 1.1 Process Pending Grievances for HR & Management
  useEffect(() => {
    if (!user || !Array.isArray(penalties) || penalties.length === 0) return;

    const isHROrAdmin = isAdmin || isHR || 
      String(profile?.role || '').toLowerCase().includes('hr') || 
      String(profile?.role || '').toLowerCase().includes('admin');

    if (!isHROrAdmin) return;

    const newGrievanceNotifs: NotificationItem[] = [];

    penalties.forEach(p => {
      const isPending = (p.hasGrievance === true || (p as any).hasGrievance === 1) && 
        (p.grievanceStatus === 'Pending' || (!p.grievanceStatus && p.grievanceReason));

      if (!isPending) return;

      const grievanceKey = `${p.id}_${p.updatedAt || p.grievanceDate || 'pending'}`;
      if (!seenGrievances.current.has(grievanceKey)) {
        seenGrievances.current.add(grievanceKey);

        newGrievanceNotifs.push({
          id: `grievance-${p.id}`,
          title: `📩 تظلم إداري جديد وارد (قرار رقم ${p.penaltyNumber || p.id})`,
          message: `قدم الموظف (${p.employeeName || 'موظف'}) تظلماً إدارياً رسمياً. سبب التظلم: "${p.grievanceReason || 'مراجعة الجزاء'}". يرجى المراجعة والبت في القرار.`,
          timestamp: new Date()
        });
      }
    });

    if (newGrievanceNotifs.length > 0) {
      setNotifications(prev => [...prev, ...newGrievanceNotifs].slice(-5));
      try {
        playTodayDueAlertSound();
      } catch (err) {}
    }
  }, [penalties, user, profile, isAdmin, isHR]);

  // 2. Process Daily Task Deadlines (Today & Overdue) - ONLY for tasks assigned to the current user
  useEffect(() => {
    if (!user || !Array.isArray(projectTasks) || projectTasks.length === 0 || myEmpIdentifiers.length === 0) return;

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const todayStr = todayDate.toISOString().split('T')[0];

    const todayList: ProjectTask[] = [];
    const overdueList: ProjectTask[] = [];

    projectTasks.forEach(t => {
      // Check if task is explicitly assigned to this logged in user (ignoring creator/assigner or general admin)
      const assignedTo = t.assignedToId ? String(t.assignedToId).trim().toLowerCase() : '';
      const assignedToIds = getTaskAssignedIds(t).map(id => id.toLowerCase());
      const taskEmpId = (t as any).employeeId ? String((t as any).employeeId).trim().toLowerCase() : '';

      const isAssignedToUser = myEmpIdentifiers.includes(assignedTo) ||
                               assignedToIds.some(id => myEmpIdentifiers.includes(id)) ||
                               (taskEmpId && myEmpIdentifiers.includes(taskEmpId));

      if (!isAssignedToUser) return;

      // Skip completed / executed / approved / closed tasks
      const isDone = !isOpenTask(t);
      if (isDone) return;

      const dateVal = t.endDate || t.startDate;
      if (!dateVal) return;

      const taskDate = new Date(dateVal);
      taskDate.setHours(0, 0, 0, 0);
      const taskDateStr = taskDate.toISOString().split('T')[0];

      if (taskDateStr === todayStr) {
        todayList.push(t);
      } else if (taskDate < todayDate) {
        overdueList.push(t);
      }
    });

    setTodayTasks(todayList);
    setOverdueTasks(overdueList);

    const totalCount = todayList.length + overdueList.length;

    if (totalCount > 0) {
      // Check if alert sound played today for this user
      const playedKey = `task_deadline_alert_played_${todayStr}_${user.uid}`;
      const hasPlayedToday = localStorage.getItem(playedKey);

      if (!hasPlayedToday) {
        // Trigger alert chime & show banner: play overdue alarm if overdue tasks exist, otherwise play today chime
        setTimeout(() => {
          if (overdueList.length > 0) {
            playOverdueAlertSound();
          } else {
            playTodayDueAlertSound();
          }
          setIsDeadlineBannerOpen(true);
          localStorage.setItem(playedKey, 'true');
        }, 1200);
      }
    }
  }, [projectTasks, user, myEmpIdentifiers]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Auto-remove toast notifications after 6s
  useEffect(() => {
    if (notifications.length > 0) {
      const timer = setTimeout(() => {
        setNotifications(prev => prev.slice(1));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [notifications]);

  const totalDeadlines = todayTasks.length + overdueTasks.length;

  return (
    <>
      {/* 1. Daily Task Deadlines Sound & Banner Notification */}
      <AnimatePresence>
        {isDeadlineBannerOpen && totalDeadlines > 0 && (
          <div className="fixed top-4 left-4 z-[999] w-full max-w-md pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="bg-card text-foreground border-2 border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-500/15 via-red-500/10 to-amber-500/5 p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md animate-pulse">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-foreground">تنبيه المهام اليومية والمتأخرة</h4>
                    <p className="text-[11px] text-muted-foreground font-medium">تذكير تلقائي بمواعيد التسليم الفعالة</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      if (overdueTasks.length > 0) playOverdueAlertSound();
                      else playTodayDueAlertSound();
                    }}
                    className="p-2 text-amber-600 hover:bg-amber-500/10 rounded-xl transition-colors cursor-pointer"
                    title="إعادة تشغيل نغمة التنبيه"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsDeadlineBannerOpen(false)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Status summary counters with sound test triggers */}
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={playOverdueAlertSound}
                    className="p-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 rounded-2xl flex items-center gap-2.5 text-right transition-all cursor-pointer group"
                    title="اضغط لسماع إنذار المهام المتأخرة"
                  >
                    <Clock className="w-5 h-5 text-red-500 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <span className="text-xs font-black text-red-600 block">{overdueTasks.length} مهام متأخرة</span>
                      <span className="text-[10px] font-bold text-red-500/80 flex items-center gap-1">
                        <Volume2 className="w-3 h-3 inline" /> صوت الإنذار
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={playTodayDueAlertSound}
                    className="p-3 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 rounded-2xl flex items-center gap-2.5 text-right transition-all cursor-pointer group"
                    title="اضغط لسماع تذكير مهام اليوم"
                  >
                    <Calendar className="w-5 h-5 text-amber-500 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="min-w-0">
                      <span className="text-xs font-black text-amber-600 block">{todayTasks.length} مستحقة اليوم</span>
                      <span className="text-[10px] font-bold text-amber-500/80 flex items-center gap-1">
                        <Volume2 className="w-3 h-3 inline" /> صوت التذكير
                      </span>
                    </div>
                  </button>
                </div>

                {/* Collapsible Details list */}
                {isExpandedDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 pt-2 max-h-52 overflow-y-auto custom-scrollbar border-t border-border"
                  >
                    {overdueTasks.map(t => (
                      <div key={t.id} className="p-2.5 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                          <span className="font-bold text-foreground truncate">{t.title}</span>
                        </div>
                        <span className="text-[10px] font-black text-red-600 bg-red-500/10 px-2 py-0.5 rounded-md shrink-0">متأخرة</span>
                      </div>
                    ))}

                    {todayTasks.map(t => (
                      <div key={t.id} className="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span className="font-bold text-foreground truncate">{t.title}</span>
                        </div>
                        <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md shrink-0">مستحقة اليوم</span>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={() => setIsExpandedDetails(!isExpandedDetails)}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                  >
                    {isExpandedDetails ? (
                      <>
                        <span>إخفاء التفاصيل</span>
                        <ChevronUp className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      <>
                        <span>استعراض المهام ({totalDeadlines})</span>
                        <ChevronDown className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>

                  <button
                    onClick={playTaskAlertSound}
                    className="px-3 py-1.5 bg-amber-500 text-white font-black text-xs rounded-xl shadow-xs hover:bg-amber-600 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>سماع التنبيه</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Floating Quick Trigger Badge for Task Deadlines */}
      {totalDeadlines > 0 && !isDeadlineBannerOpen && (
        <button
          onClick={() => {
            setIsDeadlineBannerOpen(true);
            if (overdueTasks.length > 0) playOverdueAlertSound();
            else playTodayDueAlertSound();
          }}
          className="fixed top-4 left-4 z-[990] bg-gradient-to-r from-amber-500 to-red-500 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-white/20"
          title="تنبيهات المهام المستحقة والمتأخرة"
        >
          <div className="relative">
            <Bell className="w-4 h-4 animate-bounce" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-white animate-ping" />
          </div>
          <span className="text-xs font-black">{totalDeadlines} مهام للتنبيه</span>
          <Volume2 className="w-3.5 h-3.5 opacity-80" />
        </button>
      )}

      {/* 3. Toast Notifications for Chat Messages / Comments */}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col-reverse gap-3 pointer-events-none w-80">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="bg-card text-foreground rounded-2xl shadow-2xl p-4 border border-border pointer-events-auto flex gap-3 overflow-hidden"
              layout
            >
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex shrink-0 items-center justify-center border border-primary/20">
                <Bell className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <h4 className="text-sm font-black text-foreground truncate">{notif.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {notif.message}
                </p>
              </div>
              <button
                onClick={() => removeNotification(notif.id)}
                className="text-muted-foreground hover:text-foreground transition-colors self-start shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {/* 4. Floating Animated Distinct Red Ball for Administrative Notices */}
      {unreadAdminNotices.length > 0 && (
        <motion.button
          onClick={() => setIsNoticeModalOpen(true)}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 right-6 z-[995] group cursor-pointer flex items-center gap-3 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white pl-5 pr-4 py-3.5 rounded-none border-2 border-slate-900 dark:border-slate-800 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all"
          title="افتح شاشة التنبيهات الإدارية"
        >
          {/* Red Animated Pulsing Sphere */}
          <div className="relative flex items-center justify-center w-7 h-7">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-6 w-6 bg-red-500 border-2 border-white items-center justify-center shadow-inner">
              <Bell className="w-3.5 h-3.5 text-white animate-bounce" />
            </span>
          </div>

          <div className="text-right">
            <span className="text-xs font-black block text-white drop-shadow-sm leading-tight">
              التنبيهات الإدارية
            </span>
            <span className="text-[10px] font-extrabold text-red-100 block">
              {unreadAdminNotices.length} {unreadAdminNotices.length === 1 ? 'تنبيه جديد' : 'تنبيهات جديدة'}
            </span>
          </div>
        </motion.button>
      )}

      {/* Notice Display Modal Component */}
      <NoticeDisplayModal
        isOpen={isNoticeModalOpen}
        onClose={() => setIsNoticeModalOpen(false)}
        onNavigateToFullPage={handleNavigateToNotices}
      />
    </>
  );
};
