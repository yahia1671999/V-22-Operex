import React, { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Plus,
  Search,
  Trash2,
  Edit3,
  Eye,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  FileText,
  CheckCircle2,
  Sparkles,
  Printer,
  Filter,
  AlertCircle,
  AlertTriangle,
  X,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Palette,
  RotateCcw,
  Tag,
  Users,
  Award,
  Megaphone,
  Check,
  Building2,
  Scale,
  Send,
  CheckCircle,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  AdministrativeNotice,
  NoticeCategory,
  NoticePriority,
} from "../../types";
import { cn } from "../../lib/utils";
import { sanitizeHtml } from "../../utils/sanitizeHtml";
import { RichTextEditor } from "../common/RichTextEditor";

export const AdminNotices: React.FC = () => {
  const {
    administrativeNotices,
    investigations = [],
    penalties = [],
    employees = [],
    addAdministrativeNotice,
    updateAdministrativeNotice,
    deleteAdministrativeNotice,
    markNoticeAsRead,
    adminDepartments,
    systemSettings,
  } = useData();
  const { user, profile, isAdmin, isHR } = useAuth();
  const { canView, can } = usePermissions();

  const [mainTab, setMainTab] = useState<"all" | "my_notices">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] =
    useState<AdministrativeNotice | null>(null);
  const [viewingNotice, setViewingNotice] =
    useState<AdministrativeNotice | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Grievance submission modal state
  const [grievanceModal, setGrievanceModal] = useState<{
    isOpen: boolean;
    penalty: any;
    reason: string;
    submitting: boolean;
  }>({
    isOpen: false,
    penalty: null,
    reason: "",
    submitting: false,
  });

  const handleGrievanceSubmit = async () => {
    if (!grievanceModal.penalty || !grievanceModal.reason.trim()) {
      alert("يرجى كتابة سبب وتفاصيل التظلم الإداري");
      return;
    }
    setGrievanceModal((prev) => ({ ...prev, submitting: true }));
    try {
      const pen = grievanceModal.penalty;
      const currentUserDisplayName = profile?.name || user?.email || "الموظف";
      const existingAudit = Array.isArray(pen.auditTrail) ? pen.auditTrail : [];
      const newAuditEntry = {
        timestamp: new Date().toISOString(),
        userName: currentUserDisplayName,
        action: "تقديم تظلم إداري من الموظف",
        comment: grievanceModal.reason.trim(),
        previousStatus: pen.status,
        newStatus: pen.status,
      };

      const updatedPayload = {
        hasGrievance: true,
        grievanceReason: grievanceModal.reason.trim(),
        grievanceDate: new Date().toISOString().split("T")[0],
        grievanceStatus: "Pending",
        preGrievancePenaltyType: pen.penaltyType,
        preGrievanceDeductionType: pen.deductionType,
        preGrievanceDeductionValue: pen.deductionValue,
        auditTrail: [...existingAudit, newAuditEntry],
        updatedAt: new Date().toISOString(),
      };

      let res = await fetch(`/api/penalties/${pen.id}/grievance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          reason: grievanceModal.reason.trim(),
          grievanceReason: grievanceModal.reason.trim(),
        }),
      });

      if (!res.ok) {
        // Fallback to PATCH
        res = await fetch(`/api/penalties/${pen.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify(updatedPayload),
        });
      }

      if (!res.ok) {
        throw new Error("Failed to submit grievance");
      }

      // Create/Update notice for HR and Management regarding the grievance
      try {
        const noticePayload = {
          id: `NOTICE-GRIEVANCE-${pen.id}`,
          title: `تظلم إداري وارد على الجزاء رقم ${pen.penaltyNumber || pen.id} - ${currentUserDisplayName}`,
          category: "decision",
          priority: "urgent",
          noticeDate: new Date().toISOString().split("T")[0],
          startDate: new Date().toISOString().split("T")[0],
          durationDays: 14,
          isPermanent: false,
          content: `<div style="direction: rtl; font-family: system-ui; padding: 14px; border: 2px solid #6366f1; border-radius: 10px; background: #faf5ff;">
            <h4 style="color: #4338ca; margin-top: 0;">📩 تظلم إداري مقدم من الموظف</h4>
            <p><strong>الموظف المتظلم:</strong> ${currentUserDisplayName}</p>
            <p><strong>رقم الجزاء:</strong> ${pen.penaltyNumber || pen.id}</p>
            <p><strong>نوع الجزاء الحالي:</strong> ${pen.penaltyType} (${pen.deductionValue || 0} ${pen.deductionType === "Days" ? "يوم" : "جنيه"})</p>
            <p><strong>سبب التظلم:</strong> ${grievanceModal.reason.trim()}</p>
            <hr style="border: 0; border-top: 1px dashed #c7d2fe;"/>
            <p style="color: #4338ca; font-size: 11px; font-weight: bold;">يرجى من إدارة الموارد البشرية مراجعة التظلم واتخاذ الإجراء اللازم (تعديل الجزاء أو رفض التظلم).</p>
          </div>`,
          targetAudience: ["all"],
          status: "Published",
          readBy: [],
          createdById: profile?.id || user?.uid || "system",
          createdByName: currentUserDisplayName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await fetch(`/api/administrative-notices/${noticePayload.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify(noticePayload),
        });
      } catch (err) {
        console.warn("Notice creation warning:", err);
      }

      setGrievanceModal({
        isOpen: false,
        penalty: null,
        reason: "",
        submitting: false,
      });
      alert("تم تقديم تظلمك الإداري بنجاح، وستتم مراجعته والبت فيه من قبل إدارة الموارد البشرية.");
      window.location.reload();
    } catch (err: any) {
      alert("حدث خطأ أثناء تقديم التظلم: " + err.message);
      setGrievanceModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Identify current logged in employee
  const currentEmployee = useMemo(() => {
    const userEmail = (user?.email || profile?.email || "")
      .toLowerCase()
      .trim();
    const userId = profile?.id || user?.uid || "";
    const userEmpId = profile?.employeeId || (user as any)?.employeeId || "";
    return (
      employees.find(
        (e) =>
          (e.email && e.email.toLowerCase().trim() === userEmail) ||
          e.id === userId ||
          e.userId === userId ||
          (userEmpId && (e.id === userEmpId || e.employeeId === userEmpId)),
      ) || null
    );
  }, [employees, user, profile]);

  // My Investigations - STRICT TARGET EMPLOYEE MATCHING ONLY (NEVER SHOW TO MANAGERS/CREATORS)
  const myInvestigations = useMemo(() => {
    if (!currentEmployee) return [];

    const targetEmpIds = [
      currentEmployee.id,
      currentEmployee.employeeId,
      currentEmployee.userId,
      currentEmployee.email,
    ]
      .filter(Boolean)
      .map((x) => String(x).trim().toLowerCase());

    if (targetEmpIds.length === 0) return [];

    return (investigations || []).filter((inv: any) => {
      // Never show to the manager or creator of the investigation session
      const isCreatorOrManager =
        (inv.createdById &&
          (inv.createdById === profile?.id || inv.createdById === user?.uid)) ||
        (inv.createdBy &&
          profile?.name &&
          inv.createdBy.toLowerCase() === profile.name.toLowerCase()) ||
        (inv.managerIds && String(inv.managerIds).includes(currentEmployee.id));

      if (isCreatorOrManager) return false;

      let empArr: string[] = [];
      try {
        empArr =
          typeof inv.employeeIds === "string"
            ? JSON.parse(inv.employeeIds)
            : inv.employeeIds || [];
      } catch (e) {}
      if (!Array.isArray(empArr)) empArr = [];

      const invIdentifiers = [inv.employeeId, inv.userId, inv.email, ...empArr]
        .filter(Boolean)
        .map((x) => String(x).trim().toLowerCase());

      return invIdentifiers.some((id) =>
        targetEmpIds.some((eId) => eId === id),
      );
    });
  }, [investigations, currentEmployee, profile, user]);

  // My Penalties
  const myPenalties = useMemo(() => {
    const empIds = [
      currentEmployee?.id,
      currentEmployee?.employeeId,
      currentEmployee?.userId,
      currentEmployee?.email,
      currentEmployee?.name,
      profile?.id,
      user?.uid,
      user?.email,
    ]
      .filter(Boolean)
      .map((x) => String(x).trim().toLowerCase());

    return (penalties || []).filter((p: any) => {
      const pEmpId = String(p.employeeId || p.employeeName || "")
        .trim()
        .toLowerCase();
      return empIds.some((id) => id === pEmpId || pEmpId.includes(id));
    });
  }, [penalties, currentEmployee, profile, user]);

  // Form State for Word-like Notice Creator
  const [formData, setFormData] = useState({
    title: "",
    category: "decision" as NoticeCategory,
    priority: "normal" as NoticePriority,
    noticeDate: new Date().toISOString().split("T")[0],
    startDate: new Date().toISOString().split("T")[0],
    durationDays: 7,
    isPermanent: false,
    content: "<p>اكتب نص التنبيه أو القرار الإداري هنا...</p>",
    targetAudience: ["all"],
  });

  const editorRef = useRef<HTMLDivElement>(null);

  const canManageNotices =
    can("admin.notices.manage") ||
    can("admin.notices.*") ||
    isAdmin ||
    isHR ||
    canView("admin_notices") ||
    canView("users") ||
    [
      "Super Admin",
      "Admin",
      "Executive Director",
      "General Manager",
      "CEO",
    ].includes(profile?.role || "");

  const currentUserId = profile?.id || user?.uid || "";

  // Filter General Notices according to validity date, search query, category and strict public targeting
  const filteredNotices = useMemo(() => {
    return (administrativeNotices || [])
      .filter((notice) => {
        // 1. Exclude targeted investigation notices or notices meant for specific individuals
        const titleLower = (notice.title || "").toLowerCase();
        const contentLower = (notice.content || "").toLowerCase();
        const isInvestigationNotice =
          titleLower.includes("جلسة تحقيق") ||
          titleLower.includes("تحقيق إداري") ||
          (notice.category as string) === "investigation";

        const targetAudience = notice.targetAudience || ["all"];
        const isTargetedToSpecific =
          Array.isArray(targetAudience) &&
          targetAudience.length > 0 &&
          !targetAudience.includes("all");

        if (isInvestigationNotice || isTargetedToSpecific) {
          return false; // MUST NOT appear in general public notices tab
        }

        const matchesSearch =
          titleLower.includes(searchQuery.toLowerCase()) ||
          contentLower.includes(searchQuery.toLowerCase()) ||
          (notice.createdByName &&
            notice.createdByName
              .toLowerCase()
              .includes(searchQuery.toLowerCase()));

        const matchesCategory =
          selectedCategory === "all" || notice.category === selectedCategory;

        return matchesSearch && matchesCategory;
      })
      .sort(
        (a, b) =>
          new Date(b.noticeDate || b.createdAt || 0).getTime() -
          new Date(a.noticeDate || a.createdAt || 0).getTime(),
      );
  }, [administrativeNotices, searchQuery, selectedCategory]);

  const handleOpenCreateModal = () => {
    setEditingNotice(null);
    setFormData({
      title: "",
      category: "decision",
      priority: "normal",
      noticeDate: new Date().toISOString().split("T")[0],
      startDate: new Date().toISOString().split("T")[0],
      durationDays: 7,
      isPermanent: false,
      content:
        "<p>بسم الله الرحمن الرحيم</p><p><strong>السادة الموظفين المحترمين،</strong></p><p>تود الإدارة العليا إفادتكم بما يلي...</p>",
      targetAudience: ["all"],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (notice: AdministrativeNotice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      category: notice.category || "decision",
      priority: notice.priority || "normal",
      noticeDate: notice.noticeDate || new Date().toISOString().split("T")[0],
      startDate: notice.startDate || new Date().toISOString().split("T")[0],
      durationDays: notice.durationDays || 7,
      isPermanent: Boolean(notice.isPermanent),
      content: notice.content,
      targetAudience: notice.targetAudience || ["all"],
    });
    setIsModalOpen(true);
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();

    const htmlContent = formData.content;

    if (!formData.title.trim()) {
      alert("يرجى إدخال عنوان التنبيه الإداري");
      return;
    }

    const creatorName = profile?.name || user?.displayName || "الادارة العليا";
    const creatorRole =
      profile?.role || (isAdmin ? "الادارة العليا" : "إدارة الموارد البشرية");

    const noticePayload: Partial<AdministrativeNotice> = {
      title: formData.title,
      content: htmlContent,
      category: formData.category,
      priority: formData.priority,
      noticeDate: formData.noticeDate,
      startDate: formData.startDate,
      durationDays: Number(formData.durationDays),
      isPermanent: formData.isPermanent,
      targetAudience: formData.targetAudience,
      createdByName: creatorName,
      createdByRole: creatorRole,
      createdById: currentUserId,
      status: "Published",
    };

    let success = false;
    if (editingNotice) {
      success = await updateAdministrativeNotice(
        editingNotice.id,
        noticePayload,
      );
    } else {
      success = await addAdministrativeNotice(noticePayload);
    }

    if (success) {
      setIsModalOpen(false);
      setEditingNotice(null);
    } else {
      alert("حدث خطأ أثناء حفظ التنبيه الإداري، يرجى المحاولة مرة أخرى");
    }
  };

  const handleDelete = async (id: string) => {
    if (
      window.confirm(
        "هل أنت تأكد من مسح هذا التنبيه الإداري؟ سيتم مسحه بشكل نهائي من جميع أجهزة اليوزرات المنشور عليهم.",
      )
    ) {
      setIsDeletingId(id);
      await deleteAdministrativeNotice(id);
      setIsDeletingId(null);
      if (viewingNotice?.id === id) {
        setViewingNotice(null);
      }
    }
  };

  const handleViewNotice = async (notice: AdministrativeNotice) => {
    setViewingNotice(notice);
    // Mark as read for this user
    await markNoticeAsRead(notice.id);
  };

  // Word Format Exec Commands
  const formatText = (
    command: string,
    value: string | undefined = undefined,
  ) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setFormData((prev) => ({
        ...prev,
        content: editorRef.current?.innerHTML || prev.content,
      }));
    }
  };

  const getCategoryBadge = (category?: NoticeCategory) => {
    switch (category) {
      case "decision":
        return {
          label: "قرار إداري رسمي",
          bg: "bg-red-500/10 text-red-600 border-red-500/20",
          icon: ShieldCheck,
        };
      case "greeting":
        return {
          label: "تهنئة ومناسبة",
          bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
          icon: Award,
        };
      case "circular":
        return {
          label: "تعميم إداري",
          bg: "bg-blue-500/10 text-blue-600 border-blue-500/20",
          icon: Megaphone,
        };
      case "instruction":
        return {
          label: "تعليمات تنظيمية",
          bg: "bg-purple-500/10 text-purple-600 border-purple-500/20",
          icon: FileText,
        };
      default:
        return {
          label: "تنبيه إداري",
          bg: "bg-amber-500/10 text-amber-600 border-amber-500/20",
          icon: Bell,
        };
    }
  };

  const getPriorityBadge = (priority?: NoticePriority) => {
    switch (priority) {
      case "urgent":
        return {
          label: "عاجل وهام جداً",
          bg: "bg-red-600 text-white animate-pulse",
        };
      case "high":
        return { label: "أولوية عالية", bg: "bg-amber-500 text-white" };
      default:
        return {
          label: "عادي",
          bg: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        };
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-black text-white border border-white/30">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>تواصل الإدارة العليا والقرارات الرسمية</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black">
              التنبيهات والقرارات الإدارية
            </h1>
            <p className="text-white/80 text-xs md:text-sm max-w-2xl font-medium leading-relaxed">
              الشاشة الرسمية لإبلاغ الموظفين بكافة القرارات والتعاميم والتهاني
              والتنبيهات الإدارية الصادرة من الإدارة العليا.
            </p>
          </div>

          {canManageNotices && (
            <button
              onClick={handleOpenCreateModal}
              className="px-6 py-3.5 bg-white text-red-600 hover:bg-amber-50 font-black text-sm rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2.5 shrink-0 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>إضافة تنبيه إداري جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation Bar */}
      <div className="flex items-center gap-3 border-b-2 border-border pb-3 overflow-x-auto">
        <button
          onClick={() => setMainTab("all")}
          className={cn(
            "px-6 py-3 rounded-2xl font-black text-xs md:text-sm transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap",
            mainTab === "all"
              ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
              : "bg-card border border-border text-foreground hover:bg-muted",
          )}
        >
          <Bell className="w-4 h-4" />
          <span>التنبيهات والقرارات الإدارية العامة</span>
        </button>

        <button
          onClick={() => setMainTab("my_notices")}
          className={cn(
            "px-6 py-3 rounded-2xl font-black text-xs md:text-sm transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap",
            mainTab === "my_notices"
              ? "bg-red-600 text-white shadow-lg shadow-red-600/20"
              : "bg-card border border-border text-foreground hover:bg-muted",
          )}
        >
          <ShieldCheck className="w-4 h-4 text-amber-300" />
          <span>تنبيهات إدارية مختصة بي</span>
          {myInvestigations.length + myPenalties.length > 0 && (
            <span className="bg-amber-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full">
              {myInvestigations.length + myPenalties.length}
            </span>
          )}
        </button>
      </div>

      {mainTab === "my_notices" ? (
        <div className="space-y-8">
          {/* SECTION 1: INVESTIGATIONS */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-red-600/10 p-4 rounded-2xl border border-red-600/20">
              <ShieldCheck className="w-6 h-6 text-red-600" />
              <div>
                <h2 className="font-black text-base text-foreground">
                  جلسات التحقيق الإداري الخاصة بي
                </h2>
                <p className="text-xs text-muted-foreground font-medium">
                  جلسات التحقيق الموجهة إليك للحضور والتواجد في الموعد والمكان
                  المحددين
                </p>
              </div>
            </div>

            {myInvestigations.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground font-bold text-xs">
                لا توجد جلسات تحقيق إداري مسجلة بحقك حالياً
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myInvestigations.map((inv: any) => {
                  let targetEmpName = inv.employeeName;
                  if (!targetEmpName && inv.employeeIds) {
                    let eArr: string[] = [];
                    try {
                      eArr =
                        typeof inv.employeeIds === "string"
                          ? JSON.parse(inv.employeeIds)
                          : inv.employeeIds || [];
                    } catch (e) {}
                    const matchedEmps = employees.filter(
                      (e) => eArr.includes(e.id) || eArr.includes(e.employeeId),
                    );
                    if (matchedEmps.length > 0) {
                      targetEmpName = matchedEmps.map((e) => e.name).join(", ");
                    }
                  }
                  if (!targetEmpName) {
                    targetEmpName = currentEmployee?.name || "أنت";
                  }

                  return (
                    <div
                      key={inv.id}
                      className="bg-card border-2 border-red-600/30 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-black text-red-600 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20 dir-ltr inline-block mb-1">
                            {inv.investigationNumber || inv.id}
                          </span>
                          <h3 className="font-black text-sm text-foreground">
                            {inv.title}
                          </h3>
                          <p className="text-xs font-bold text-foreground flex items-center gap-1 mt-0.5">
                            <User className="w-3.5 h-3.5 text-red-600" />
                            <span>
                              الموظف المدعو لحضور التحقيق:{" "}
                              <strong className="text-red-600 font-extrabold">
                                {targetEmpName}
                              </strong>
                            </span>
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 text-[10px] font-black rounded-full shrink-0 border ${
                            inv.status === "Completed"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : inv.status === "Cancelled"
                                ? "bg-slate-500/10 text-slate-600 border-slate-500/20"
                                : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          }`}
                        >
                          {inv.status === "Completed"
                            ? "مكتملة"
                            : inv.status === "Cancelled"
                              ? "ملغاة"
                              : "جلسة مجدولة"}
                        </span>
                      </div>

                      {inv.reason && (
                        <p className="text-xs text-foreground font-bold bg-muted p-3 rounded-xl border border-border">
                          <strong className="text-foreground">
                            سبب التحقيق والتفاصيل:
                          </strong>{" "}
                          {inv.reason}
                        </p>
                      )}

                      {(inv.recommendation || inv.notes) && (
                        <div className="bg-red-500/10 p-3 rounded-xl border border-red-500/20 text-xs space-y-0.5">
                          <span className="font-black text-red-600 block">
                            القرارات والجزاءات الصادرة:
                          </span>
                          <p className="text-foreground font-bold">
                            {inv.recommendation || inv.notes}
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-2 border-t border-border">
                        <div className="flex items-center gap-2 text-foreground">
                          <Calendar className="w-3.5 h-3.5 text-red-600" />
                          <span>التاريخ: {inv.investigationDate}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground">
                          <Clock className="w-3.5 h-3.5 text-red-600" />
                          <span>الوقت: {inv.investigationTime}</span>
                        </div>
                        <div className="col-span-2 flex items-center gap-2 text-foreground">
                          <FileText className="w-3.5 h-3.5 text-red-600" />
                          <span>
                            المكان: {inv.location || "الشؤون القانونية"} |
                            المحقق:{" "}
                            {inv.investigatorName || "المستشار القانوني"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: PENALTIES */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-amber-600/10 p-4 rounded-2xl border border-amber-600/20">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
              <div>
                <h2 className="font-black text-base text-foreground">
                  الجزاءات والمخالفات الواقعة علي
                </h2>
                <p className="text-xs text-muted-foreground font-medium">
                  سجل القرارات والجزاءات الصادرة بحق الموظف
                </p>
              </div>
            </div>

            {myPenalties.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground font-bold text-xs">
                لا توجد جزاءات أو مخالفات مسجلة بحقك
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myPenalties.map((p: any) => (
                  <div
                    key={p.id}
                    className="bg-card border-2 border-border rounded-2xl p-5 shadow-sm space-y-3.5 relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 dir-ltr inline-block mb-1 font-mono">
                          {p.penaltyNumber || p.id}
                        </span>
                        <h3 className="font-black text-sm text-foreground">
                          {p.violationType || "مخالفة إدارية"}
                        </h3>
                        <p className="text-[11px] text-muted-foreground font-bold mt-0.5">
                          تاريخ المخالفة: {p.violationDate || "-"}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "px-2.5 py-1 text-[10px] font-black rounded-full border shrink-0",
                          p.status === "Approved"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : p.status === "Cancelled"
                              ? "bg-slate-500/10 text-slate-600 border-slate-500/20"
                              : p.status === "Rejected"
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                : "bg-amber-500/10 text-amber-600 border-amber-500/20",
                        )}
                      >
                        {p.status === "Approved"
                          ? "معتمد نهائياً"
                          : p.status === "Pending Direct Manager"
                            ? "بانتظار المدير المباشر"
                            : p.status === "Pending Higher Manager"
                              ? "بانتظار الرئيس الأعلى"
                              : p.status === "Pending HR"
                                ? "بانتظار اعتماد الموارد البشرية"
                                : p.status === "Cancelled"
                                  ? "تم إلغاء الجزاء"
                                  : p.status === "Rejected"
                                    ? "مرفوض"
                                    : "قيد المراجعة"}
                      </span>
                    </div>

                    {p.description && (
                      <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border/50">
                        {p.description}
                      </p>
                    )}

                    {/* RECORDED OPINIONS & WORKFLOW LOG */}
                    <div className="space-y-1.5 text-xs bg-muted/20 p-3 rounded-xl border border-border/60">
                      <div className="font-black text-[11px] text-foreground mb-1">
                        سجل آراء ومسار الاعتماد الإداري:
                      </div>

                      {/* Direct Manager */}
                      <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5">
                        <span className="font-bold text-muted-foreground">رأي المدير المباشر:</span>
                        <span className="font-black text-right">
                          {p.directManagerDecision === "Approved" ? (
                            <span className="text-emerald-600">✅ موافقة</span>
                          ) : p.directManagerDecision === "Objected" ? (
                            <span className="text-rose-600">❌ اعتراض: {p.directManagerObjectionReason || "دون تفاصيل"}</span>
                          ) : (
                            <span className="text-amber-600 font-medium">بانتظار الرأي</span>
                          )}
                        </span>
                      </div>

                      {/* Higher Manager */}
                      <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5">
                        <span className="font-bold text-muted-foreground">رأي الرئيس الأعلى:</span>
                        <span className="font-black text-right">
                          {p.higherManagerDecision === "Approved" ? (
                            <span className="text-emerald-600">✅ موافقة</span>
                          ) : p.higherManagerDecision === "Objected" ? (
                            <span className="text-rose-600">❌ اعتراض / رأي: {p.higherManagerObjectionReason || "دون تفاصيل"}</span>
                          ) : (
                            <span className="text-amber-600 font-medium">بانتظار الرأي</span>
                          )}
                        </span>
                      </div>

                      {/* HR Decision */}
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-muted-foreground">قرار الموارد البشرية:</span>
                        <span className="font-black text-right">
                          {p.status === "Approved" ? (
                            <span className="text-emerald-600">✅ معتمد رسمياً بملف الموظف</span>
                          ) : p.status === "Cancelled" ? (
                            <span className="text-slate-600">🚫 ملغى / موقوف ({p.cancellationReason || "بقرار الإدارة"})</span>
                          ) : (
                            <span className="text-blue-600 font-medium">قيد التدقيق والاعتماد</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* GRIEVANCE SECTION */}
                    {p.hasGrievance ? (
                      <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-indigo-700 flex items-center gap-1">
                            <Scale className="w-3.5 h-3.5" />
                            تظلمك الإداري المقدم:
                          </span>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-800">
                            {p.grievanceStatus === "Pending"
                              ? "قيد دراسة HR"
                              : p.grievanceStatus === "Accepted_Modified"
                                ? "مقبول وتم تعديل الجزاء"
                                : "مرفوض التظلم"}
                          </span>
                        </div>
                        <p className="text-foreground font-medium">
                          <strong>سبب التظلم:</strong> {p.grievanceReason}
                        </p>
                        {p.grievanceReply && (
                          <div className="pt-1.5 border-t border-indigo-500/20 text-indigo-900 dark:text-indigo-200">
                            <strong>رد وقرار إدارة الموارد البشرية:</strong> {p.grievanceReply}
                          </div>
                        )}
                        {p.grievanceStatus === "Accepted_Modified" && (
                          <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] font-bold space-y-1">
                            <div className="text-muted-foreground">
                              الجزاء الأصلي قبل التظلم: {p.preGrievancePenaltyType || "-"} ({p.preGrievanceDeductionValue || 0} {p.preGrievanceDeductionType === "Days" ? "يوم" : "جنيه"})
                            </div>
                            <div className="text-emerald-700 dark:text-emerald-400 font-black">
                              الجزاء المعتمد بعد قبول التظلم: {p.postGrievancePenaltyType || p.penaltyType} ({p.postGrievanceDeductionValue ?? p.deductionValue} {p.deductionType === "Days" ? "يوم" : "جنيه"})
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="pt-1">
                        <button
                          onClick={() => {
                            setGrievanceModal({
                              isOpen: true,
                              penalty: p,
                              reason: "",
                              submitting: false,
                            });
                          }}
                          className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span>تقديم تظلم إداري على هذا الجزاء</span>
                        </button>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-border">
                      <span className="text-foreground">
                        نوع الجزاء: {p.penaltyType || "إنذار"}
                      </span>
                      {p.deductionValue > 0 && (
                        <span className="text-red-600 font-black">
                          الخصم: {p.deductionValue}{" "}
                          {p.deductionType === "Days" ? "يوم" : "جنيه"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filters & Search Toolbar */}
          <div className="bg-card border-2 border-border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث برقم القرار أو العنوان أو المحتوى..."
                className="w-full bg-input border border-border pr-10 pl-4 py-2.5 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/40"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              {[
                { id: "all", label: "جميع التنبيهات" },
                { id: "decision", label: "قرارات إدارية" },
                { id: "circular", label: "تعاميم" },
                { id: "greeting", label: "تهاني ومعايدات" },
                { id: "instruction", label: "تعليمات" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer",
                    selectedCategory === cat.id
                      ? "bg-red-600 text-white shadow-md"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notices Cards Grid */}
          {filteredNotices.length === 0 ? (
            <div className="bg-card border-2 border-dashed border-border rounded-3xl p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-red-500/10 text-red-600 rounded-3xl flex items-center justify-center mx-auto">
                <Bell className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-lg text-foreground">
                  لا توجد تنبيهات إدارية حالياً
                </h3>
                <p className="text-xs text-muted-foreground font-medium">
                  لم يتم نشر أي تعاميم أو قرارات إدارية تطابق بحثك حتى الآن.
                </p>
              </div>
              {canManageNotices && (
                <button
                  onClick={handleOpenCreateModal}
                  className="px-5 py-2.5 bg-red-600 text-white font-black text-xs rounded-xl hover:bg-red-700 transition-all cursor-pointer"
                >
                  + كتابة وتأسيس أول تنبيه إداري
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredNotices.map((notice) => {
                const categoryBadge = getCategoryBadge(notice.category);
                const priorityBadge = getPriorityBadge(notice.priority);
                const CategoryIcon = categoryBadge.icon;

                return (
                  <motion.div
                    key={notice.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border-2 border-border rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group hover:border-red-500/50 relative overflow-hidden"
                  >
                    <div className="space-y-4">
                      {/* Badge bar */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black border flex items-center gap-1.5",
                            categoryBadge.bg,
                          )}
                        >
                          <CategoryIcon className="w-3.5 h-3.5" />
                          <span>{categoryBadge.label}</span>
                        </span>

                        <span
                          className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-black",
                            priorityBadge.bg,
                          )}
                        >
                          {priorityBadge.label}
                        </span>
                      </div>

                      {/* Title & Preview */}
                      <div className="space-y-2">
                        <h3 className="font-black text-base text-foreground group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                          {notice.title}
                        </h3>
                        <div
                          className="text-muted-foreground text-xs line-clamp-3 font-medium leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(notice.content) }}
                        />
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-4 mt-6 border-t border-border/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold">
                        <Calendar className="w-3.5 h-3.5 text-red-500" />
                        <span>{notice.noticeDate || notice.startDate}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setViewingNotice(notice)}
                          className="px-3.5 py-1.5 bg-muted hover:bg-red-600 hover:text-white text-foreground rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </button>

                        {canManageNotices && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenEditModal(notice)}
                              className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 rounded-xl transition-colors cursor-pointer"
                              title="تعديل"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDelete(notice.id)}
                              disabled={isDeletingId === notice.id}
                              className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                              title="مسح التنبيه الإداري"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* WORD-LIKE RICH CREATOR MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border-2 border-border rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col my-auto"
            >
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-red-600 to-amber-600 p-6 text-white flex items-center justify-between sticky top-0 z-20">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/20 rounded-2xl backdrop-blur-md">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">
                      {editingNotice
                        ? "تعديل التنبيه الإداري"
                        : "إنشاء ونشر تنبيه إداري جديد"}
                    </h3>
                    <p className="text-xs text-white/80 font-medium">
                      محرر مستندات متكامل مع تحكم في صياغة القرارات الرسمية
                      والمدة
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form
                onSubmit={handleSaveNotice}
                className="p-6 space-y-6 flex-1"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Notice Title */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-foreground mb-1.5">
                      عنوان القرار / التنبيه الإداري *
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="مثال: قرار إداري بشأن المواعيد الرسمية لشهر رمضان المبارك..."
                      className="w-full bg-input border border-border px-4 py-3 rounded-2xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/40"
                      required
                    />
                  </div>

                  {/* Notice Category */}
                  <div>
                    <label className="block text-xs font-black text-foreground mb-1.5">
                      تصنيف التنبيه الإداري
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          category: e.target.value as NoticeCategory,
                        }))
                      }
                      className="w-full bg-input border border-border px-4 py-3 rounded-2xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/40 cursor-pointer"
                    >
                      <option value="decision">قرار إداري رسمي</option>
                      <option value="circular">تعميم إداري عام</option>
                      <option value="greeting">تهنئة ومناسبة رسمية</option>
                      <option value="instruction">تعليمات تنظيمية</option>
                      <option value="other">تنبيه عام</option>
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-xs font-black text-foreground mb-1.5">
                      درجة الأهمية والأولوية
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          priority: e.target.value as NoticePriority,
                        }))
                      }
                      className="w-full bg-input border border-border px-4 py-3 rounded-2xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/40 cursor-pointer"
                    >
                      <option value="normal">عادي (اعتيادي)</option>
                      <option value="high">هام (أولوية مرتفعة)</option>
                      <option value="urgent">
                        عاجل وهام جداً (تنبيه فوري)
                      </option>
                    </select>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-xs font-black text-foreground mb-1.5">
                      تاريخ التنبيه
                    </label>
                    <input
                      type="date"
                      value={formData.noticeDate}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          noticeDate: e.target.value,
                        }))
                      }
                      className="w-full bg-input border border-border px-4 py-3 rounded-2xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/40"
                    />
                  </div>

                  {/* Visibility Duration */}
                  <div>
                    <label className="block text-xs font-black text-foreground mb-1.5">
                      مدة الظهور والتفعيل (بالأيام)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        disabled={formData.isPermanent}
                        value={formData.durationDays}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            durationDays: Number(e.target.value),
                          }))
                        }
                        className="w-full bg-input border border-border px-4 py-3 rounded-2xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:opacity-40"
                      />
                      <label className="flex items-center gap-2 shrink-0 cursor-pointer text-xs font-bold text-foreground">
                        <input
                          type="checkbox"
                          checked={formData.isPermanent}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              isPermanent: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                        />
                        <span>تنبيه دائم</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* MS-WORD RICH TEXT TOOLBAR & CANVAS */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-foreground">
                      محتوى المستند والتنبيه الإداري (محرر نصي منسق)
                    </label>
                    <span className="text-[10px] text-muted-foreground font-bold">
                      يدعم التنسيق والخطوط والألوان والقوائم
                    </span>
                  </div>

                  <RichTextEditor
                    id="admin-notice-word-editor"
                    value={formData.content}
                    onChange={(html) =>
                      setFormData((prev) => ({
                        ...prev,
                        content: html,
                      }))
                    }
                    placeholder="اكتب نص ومحتوى التنبيه أو القرار الإداري..."
                    themeColor="red"
                    minHeight="240px"
                    maxHeight="400px"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 bg-muted text-muted-foreground font-black text-xs rounded-xl hover:bg-muted/80 transition-all cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    className="px-7 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-lg transition-all hover:scale-105 cursor-pointer flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {editingNotice
                        ? "تحديث ونشر القرار"
                        : "نشر التنبيه الإداري لجميع المستخدمين"}
                    </span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FULL ADMINISTRATIVE DOCUMENT VIEWER MODAL */}
      <AnimatePresence>
        {viewingNotice && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border-2 border-border rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col my-auto"
            >
              {/* Document Header Letterhead */}
              <div className="bg-muted/80 text-foreground p-8 rounded-t-3xl border-b-4 border-red-600 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    {systemSettings?.logoUrl ? (
                      <img
                        src={systemSettings.logoUrl}
                        alt={systemSettings.organizationName || "شعار المنشأة"}
                        className="w-12 h-12 object-contain bg-transparent"
                      />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center bg-transparent">
                        <Building2 className="w-10 h-10 text-primary" />
                      </div>
                    )}
                    <div>
                      <h2 className="font-black text-lg text-foreground">
                        القرارات الإدارية العليا
                      </h2>
                      <p className="text-xs text-muted-foreground font-medium">
                        مستند رسمي صادر عن الإدارة التنفيذية
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="p-2.5 bg-card hover:bg-muted text-foreground border border-border rounded-xl transition-colors cursor-pointer"
                      title="طباعة القرار"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setViewingNotice(null)}
                      className="p-2.5 bg-card hover:bg-muted text-foreground border border-border rounded-xl transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span>الجهة الصادرة:</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      {viewingNotice.createdByName} (
                      {viewingNotice.createdByRole})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>التاريخ:</span>
                    <span className="text-foreground">{viewingNotice.noticeDate}</span>
                  </div>
                </div>
              </div>

              {/* Document Content Paper Body */}
              <div className="p-8 space-y-6 bg-card text-foreground">
                <h1 className="text-2xl font-black text-foreground border-b-2 border-border pb-4 leading-tight">
                  {viewingNotice.title}
                </h1>

                <div
                  className="prose dark:prose-invert max-w-none text-foreground font-medium leading-relaxed text-sm space-y-4"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewingNotice.content) }}
                />

                {/* Sign-off Footer */}
                <div className="pt-8 border-t-2 border-dashed border-border flex items-center justify-between">
                  <div className="text-xs font-bold text-muted-foreground space-y-1">
                    <p className="text-foreground font-black">
                      تاريخ الاعتماد: {viewingNotice.noticeDate}
                    </p>
                  </div>
                </div>
              </div>

              {/* Close Footer */}
              <div className="p-4 bg-muted/50 border-t border-border flex justify-end">
                <button
                  onClick={() => setViewingNotice(null)}
                  className="px-6 py-2.5 bg-red-600 text-white font-black text-xs rounded-xl hover:bg-red-700 transition-all cursor-pointer"
                >
                  إغلاق المستند
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EMPLOYEE GRIEVANCE MODAL */}
      <AnimatePresence>
        {grievanceModal.isOpen && grievanceModal.penalty && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border-2 border-indigo-600/30 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4 text-right overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2 text-indigo-600 font-black">
                  <Scale className="w-5 h-5" />
                  <h3 className="text-base">تقديم تظلم إداري رسمي على الجزاء</h3>
                </div>
                <button
                  onClick={() => setGrievanceModal((prev) => ({ ...prev, isOpen: false }))}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-indigo-500/10 p-3 rounded-2xl border border-indigo-500/20 space-y-1">
                  <p className="text-foreground font-bold">
                    <strong>رقم الجزاء:</strong> {grievanceModal.penalty.penaltyNumber || grievanceModal.penalty.id}
                  </p>
                  <p className="text-foreground font-bold">
                    <strong>نوع المخالفة:</strong> {grievanceModal.penalty.violationType}
                  </p>
                  <p className="text-foreground font-bold">
                    <strong>الجزاء الصادر:</strong> {grievanceModal.penalty.penaltyType}{" "}
                    {grievanceModal.penalty.deductionValue > 0 &&
                      ` (خصم ${grievanceModal.penalty.deductionValue} ${grievanceModal.penalty.deductionType === "Days" ? "يوم" : "جنيه"})`}
                  </p>
                </div>

                <div>
                  <label className="block font-black text-foreground mb-1.5">
                    أسباب ومبررات التظلم الإداري <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={grievanceModal.reason}
                    onChange={(e) => setGrievanceModal((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="يرجى كتابة أسباب الاعتراض والمبررات والظروف الداعية لإعادة النظر في هذا الجزاء..."
                    className="w-full p-3 bg-muted/20 border border-border rounded-xl focus:ring-2 focus:ring-indigo-600 outline-none text-foreground font-medium"
                  />
                </div>

                <div className="bg-muted/40 p-3 rounded-xl text-[11px] text-muted-foreground font-medium">
                  ⚖️ سيتم إحالة هذا التظلم إلى إدارة الموارد البشرية (HR) للنظر فيه وفحصه والبت فيه إما بقبول التظلم وتعديل الجزاء أو رفض التظلم، وسيبقى مسجلاً في ملفك الإداري قبل وبعد التظلم.
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border">
                <button
                  disabled={grievanceModal.submitting || !grievanceModal.reason.trim()}
                  onClick={handleGrievanceSubmit}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Send className="w-4 h-4" />
                  <span>{grievanceModal.submitting ? "جاري الإرسال..." : "إرسال التظلم لإدارة الموارد البشرية"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGrievanceModal((prev) => ({ ...prev, isOpen: false }))}
                  className="px-5 bg-muted text-foreground font-bold py-2.5 rounded-xl text-xs hover:bg-muted/80 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
