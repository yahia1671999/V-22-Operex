import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  Eye,
  CheckCheck,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  FileText,
  Printer,
  Search,
  ExternalLink,
  Award,
  Megaphone,
  Sparkles,
  ChevronLeft,
  Tag,
  Building2
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../AuthContext';
import { AdministrativeNotice, NoticeCategory, NoticePriority } from '../../types';
import { sanitizeHtml } from '../../utils/sanitizeHtml';
import { cn } from '../../lib/utils';

interface NoticeDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToFullPage?: () => void;
}

export const NoticeDisplayModal: React.FC<NoticeDisplayModalProps> = ({
  isOpen,
  onClose,
  onNavigateToFullPage
}) => {
  const { administrativeNotices, employees = [], markNoticeAsRead, systemSettings } = useData();
  const { user, profile } = useAuth();

  const [selectedNotice, setSelectedNotice] = useState<AdministrativeNotice | null>(null);
  const [filterTab, setFilterTab] = useState<'unread' | 'all' | 'decision' | 'circular'>('unread');
  const [searchQuery, setSearchQuery] = useState('');

  const currentUserId = profile?.id || user?.uid || '';

  const myIdentifiers = useMemo(() => {
    const ids = new Set<string>();
    if (profile?.id) ids.add(String(profile.id).toLowerCase());
    if ((profile as any)?.employeeId) ids.add(String((profile as any).employeeId).toLowerCase());
    if (user?.uid) ids.add(String(user.uid).toLowerCase());
    if (user?.email) ids.add(String(user.email).toLowerCase().trim());

    const emp = employees.find(e => 
      (e.email && e.email.toLowerCase().trim() === (user?.email || profile?.email || '').toLowerCase().trim()) ||
      e.id === profile?.id ||
      e.userId === user?.uid
    );
    if (emp) {
      if (emp.id) ids.add(String(emp.id).toLowerCase());
      if (emp.employeeId) ids.add(String(emp.employeeId).toLowerCase());
      if (emp.userId) ids.add(String(emp.userId).toLowerCase());
      if (emp.email) ids.add(String(emp.email).toLowerCase().trim());
      if (emp.name) ids.add(String(emp.name).toLowerCase().trim());
    }
    return Array.from(ids);
  }, [profile, user, employees]);

  // Filter published notices
  const allPublishedNotices = useMemo(() => {
    if (!Array.isArray(administrativeNotices)) return [];
    const myName = (profile?.name || (user as any)?.displayName || '').toLowerCase().trim();
    const myEmail = (user?.email || profile?.email || '').toLowerCase().trim();

    const myEmpObj = employees.find(e => 
      (e.email && e.email.toLowerCase().trim() === myEmail) ||
      e.id === profile?.id || e.userId === user?.uid || (profile as any)?.employeeId === e.employeeId
    );

    return administrativeNotices
      .filter(n => {
        if (n.status !== 'Published') return false;

        const audience = n.targetAudience;
        const lowerAudience = Array.isArray(audience) ? audience.map(x => String(x).toLowerCase().trim()) : [];
        const titleLower = (n.title || '').toLowerCase();
        const isInvestigationOrPenalty = titleLower.includes('جلسة تحقيق') || titleLower.includes('تحقيق إداري') || titleLower.includes('جزاء') || titleLower.includes('مخالفة') || String(n.id).startsWith('NOTICE-PEN-') || (n.category as string) === 'investigation' || (n.category as string) === 'decision';

        if (isInvestigationOrPenalty) {
          const isTarget = myIdentifiers.some(id => lowerAudience.includes(id.toLowerCase()));

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

          if (isTarget || isManagerForNotice) return true;
          return false;
        } else {
          // Exclude author / creator (HR / Manager) from receiving their own created general notice
          const nCreatedById = String(n.createdById || n.publisherId || '').trim();
          const nCreatedByName = String(n.createdByName || n.createdBy || '').toLowerCase().trim();

          const isCreator = (nCreatedById && (nCreatedById === profile?.id || nCreatedById === user?.uid)) ||
            (nCreatedByName && myName && (nCreatedByName === myName || nCreatedByName === myEmail));

          if (isCreator) return false;

          if (lowerAudience.includes('all') || lowerAudience.length === 0) return true;
          const isForMe = myIdentifiers.some(id => lowerAudience.includes(id.toLowerCase()));
          return isForMe;
        }
      })
      .sort((a, b) => new Date(b.noticeDate || b.createdAt || 0).getTime() - new Date(a.noticeDate || a.createdAt || 0).getTime());
  }, [administrativeNotices, myIdentifiers, profile, user, employees]);

  // Filter based on selected tab & search
  const filteredNotices = useMemo(() => {
    return allPublishedNotices.filter(notice => {
      const isUnread = !notice.readBy || !notice.readBy.includes(currentUserId);
      const matchesSearch = notice.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        notice.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (notice.createdByName && notice.createdByName.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterTab === 'unread') return isUnread;
      if (filterTab === 'decision') return notice.category === 'decision';
      if (filterTab === 'circular') return notice.category === 'circular';

      return true; // 'all'
    });
  }, [allPublishedNotices, filterTab, searchQuery, currentUserId]);

  const unreadCount = useMemo(() => {
    return allPublishedNotices.filter(n => !n.readBy || !n.readBy.includes(currentUserId)).length;
  }, [allPublishedNotices, currentUserId]);

  const handleSelectNotice = async (notice: AdministrativeNotice) => {
    setSelectedNotice(notice);
    if (!notice.readBy || !notice.readBy.includes(currentUserId)) {
      await markNoticeAsRead(notice.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = allPublishedNotices.filter(n => !n.readBy || !n.readBy.includes(currentUserId));
    for (const notice of unread) {
      await markNoticeAsRead(notice.id);
    }
  };

  const getCategoryMeta = (category?: NoticeCategory) => {
    switch (category) {
      case 'decision':
        return { label: 'قرار إداري', bg: 'bg-red-500/10 text-red-600 border-red-500/30', icon: ShieldCheck };
      case 'greeting':
        return { label: 'تهنئة رسمية', bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: Award };
      case 'circular':
        return { label: 'تعميم إداري', bg: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: Megaphone };
      case 'instruction':
        return { label: 'تعليمات', bg: 'bg-purple-500/10 text-purple-600 border-purple-500/30', icon: FileText };
      default:
        return { label: 'تنبيه عام', bg: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Bell };
    }
  };

  const getPriorityMeta = (priority?: NoticePriority) => {
    switch (priority) {
      case 'urgent':
        return { label: 'عاجل وهام', bg: 'bg-red-600 text-white font-black' };
      case 'high':
        return { label: 'أولوية مرتفعة', bg: 'bg-amber-500 text-white font-black' };
      default:
        return { label: 'اعتيادي', bg: 'bg-muted text-muted-foreground font-bold' };
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="bg-card text-foreground border-2 border-slate-900 dark:border-slate-700 w-full max-w-4xl max-h-[90vh] shadow-[8px_8px_0px_0px_rgba(15,23,42,0.6)] dark:shadow-[8px_8px_0px_0px_rgba(34,211,238,0.2)] flex flex-col my-auto rounded-none overflow-hidden"
        >
          {/* Sharp Header */}
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-5 border-b-2 border-slate-900 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-11 h-11 bg-white/20 border-2 border-white/40 shadow-md">
                <Bell className="w-6 h-6 text-white animate-bounce" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-800 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h2 className="font-black text-lg md:text-xl flex items-center gap-2">
                  <span>التنبيهات والقرارات الإدارية العليا</span>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </h2>
                <p className="text-xs text-white/80 font-bold">
                  منصة البلاغات الفورية والقرارات الرسمية الصادرة للموظفين
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onNavigateToFullPage && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToFullPage();
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/30 text-xs font-black transition-all cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>الشاشة الرئيسية</span>
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer border border-white/30"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body: Two Columns on Large Screens */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-border">
            {/* Column 1: List & Search (4 or 5 cols) */}
            <div className="md:col-span-5 flex flex-col bg-muted/20 max-h-[400px] md:max-h-[600px] overflow-hidden border-b md:border-b-0 border-border">
              {/* Search & Tabs */}
              <div className="p-3 border-b-2 border-border space-y-2 bg-card">
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث في القرارات والتنبيهات..."
                    className="w-full bg-input border-2 border-border pr-9 pl-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-black">
                  <button
                    onClick={() => setFilterTab('unread')}
                    className={cn(
                      "px-2.5 py-1.5 border transition-all shrink-0 cursor-pointer flex items-center gap-1",
                      filterTab === 'unread'
                        ? "bg-red-600 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    <span>غير المقروءة</span>
                    {unreadCount > 0 && (
                      <span className="bg-white text-red-600 px-1.5 py-0.2 rounded-full text-[9px]">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setFilterTab('all')}
                    className={cn(
                      "px-2.5 py-1.5 border transition-all shrink-0 cursor-pointer",
                      filterTab === 'all'
                        ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    الكل ({allPublishedNotices.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('decision')}
                    className={cn(
                      "px-2.5 py-1.5 border transition-all shrink-0 cursor-pointer",
                      filterTab === 'decision'
                        ? "bg-red-600 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "bg-card text-muted-foreground border-border hover:bg-muted"
                    )}
                  >
                    قرارات
                  </button>
                </div>
              </div>

              {/* Mark all as read bar */}
              {unreadCount > 0 && (
                <div className="px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-300">
                  <span>يوجد لديك {unreadCount} تنبيه غير مقروء</span>
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] underline font-black hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer flex items-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" />
                    تحديد الكل كمقروء
                  </button>
                </div>
              )}

              {/* List Scroll Area */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                {filteredNotices.length === 0 ? (
                  <div className="p-8 text-center space-y-2 text-muted-foreground">
                    <Bell className="w-8 h-8 mx-auto text-muted-foreground/40" />
                    <p className="text-xs font-bold">لا توجد تنبيهات حالياً في هذه القائمة</p>
                  </div>
                ) : (
                  filteredNotices.map((notice) => {
                    const isRead = notice.readBy?.includes(currentUserId);
                    const isSelected = selectedNotice?.id === notice.id;
                    const catMeta = getCategoryMeta(notice.category);
                    const prioMeta = getPriorityMeta(notice.priority);
                    const CategoryIcon = catMeta.icon;

                    return (
                      <button
                        key={notice.id}
                        onClick={() => handleSelectNotice(notice)}
                        className={cn(
                          "w-full text-right p-3.5 transition-all flex flex-col gap-2 cursor-pointer relative border-l-4",
                          isSelected
                            ? "bg-card border-l-red-600 shadow-[inset_0_0_0_2px_rgba(225,29,72,0.2)]"
                            : "hover:bg-card/70 border-l-transparent",
                          !isRead ? "bg-red-500/5 font-black" : ""
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className={cn("px-2 py-0.5 text-[9px] font-black border flex items-center gap-1", catMeta.bg)}>
                            <CategoryIcon className="w-2.5 h-2.5" />
                            <span>{catMeta.label}</span>
                          </div>

                          <div className="flex items-center gap-1">
                            {!isRead && (
                              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" title="غير مقروء" />
                            )}
                            <span className={cn("px-1.5 py-0.2 text-[9px]", prioMeta.bg)}>
                              {prioMeta.label}
                            </span>
                          </div>
                        </div>

                        <h4 className="text-xs font-black text-foreground line-clamp-2 leading-snug">
                          {notice.title}
                        </h4>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold pt-1">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-red-500" />
                            {notice.createdByName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-primary" />
                            {notice.noticeDate}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Column 2: Document View Panel (7 cols) */}
            <div className="md:col-span-7 flex flex-col bg-card min-h-[350px] md:min-h-[550px] overflow-hidden">
              {selectedNotice ? (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Document Header Toolbar */}
                  <div className="p-4 border-b-2 border-border bg-muted/30 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("px-2.5 py-1 text-xs font-black border flex items-center gap-1", getCategoryMeta(selectedNotice.category).bg)}>
                        {getCategoryMeta(selectedNotice.category).label}
                      </span>
                      <span className="text-xs text-muted-foreground font-bold">
                        تاريخ القرار: {selectedNotice.noticeDate}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.print()}
                        className="px-3 py-1.5 bg-card border-2 border-slate-900 dark:border-slate-700 text-foreground text-xs font-black hover:bg-muted transition-all cursor-pointer flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>طباعة</span>
                      </button>
                    </div>
                  </div>

                  {/* Paper Content Area */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-6 text-right custom-scrollbar">
                    {/* Header Letterhead */}
                    <div className="border-b-2 border-dashed border-border pb-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {systemSettings?.logoUrl ? (
                            <img
                              src={systemSettings.logoUrl}
                              alt={systemSettings.organizationName || "شعار المنشأة"}
                              className="w-12 h-12 object-contain bg-transparent"
                            />
                          ) : (
                            <div className="w-10 h-10 flex items-center justify-center bg-transparent">
                              <Building2 className="w-8 h-8 text-primary" />
                            </div>
                          )}
                          <div>
                            <span className="text-xs font-black text-foreground block">{systemSettings?.organizationName || 'الإدارة العليا'}</span>
                            <span className="text-[10px] text-muted-foreground font-bold">القرارات والتنبيهات الرسمية</span>
                          </div>
                        </div>

                        <span className="text-xs text-red-600 font-extrabold">الجهة: {selectedNotice.createdByName}</span>
                      </div>

                      <h1 className="text-lg md:text-xl font-black text-foreground leading-snug">
                        {selectedNotice.title}
                      </h1>
                      {selectedNotice.createdByRole && (
                        <p className="text-xs font-bold text-muted-foreground">
                          صفة المُصَدِّر: {selectedNotice.createdByRole}
                        </p>
                      )}
                    </div>

                    {/* Rich HTML Content Body */}
                    <div
                      className="prose dark:prose-invert max-w-none text-foreground text-xs md:text-sm leading-relaxed font-medium space-y-3"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedNotice.content) }}
                    />

                    {/* Sign-off Footer */}
                    <div className="pt-6 border-t-2 border-border flex items-center justify-between text-xs font-bold text-muted-foreground">
                      <div>
                        <p className="text-[10px] text-muted-foreground">مدة الظهور: {selectedNotice.isPermanent ? 'دائم' : `${selectedNotice.durationDays || 7} أيام`}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Empty Selection Placeholder */
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-red-500/10 text-red-600 border-2 border-red-500/30 flex items-center justify-center">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-black text-base text-foreground">اختر تنبيهاً إدارياً لقراءته</h3>
                    <p className="text-xs text-muted-foreground max-w-xs font-medium">
                      اضغط على أي قرار أو تعميم من القائمة الجانبية لعرض نص التنبيه الإداري بالكامل
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sharp Footer Controls */}
          <div className="p-4 bg-muted/40 border-t-2 border-slate-900 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="text-xs font-bold text-muted-foreground">
              إجمالي القرارات والتنبيهات: <span className="text-foreground font-black">{allPublishedNotices.length}</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {onNavigateToFullPage && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToFullPage();
                  }}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs border-2 border-slate-900 dark:border-slate-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>الانتقال إلى شاشة التنبيهات الإدارية</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-card border-2 border-slate-900 dark:border-slate-700 text-foreground font-black text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-muted transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
