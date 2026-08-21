import React, { useState, useMemo, useEffect } from "react";
import {
  AlertTriangle,
  FileText,
  CheckCircle2,
  Check,
  Scale,
  X,
  Plus,
  Calendar,
  Coins,
  User,
  Users,
  Search,
  FileDown,
  Upload,
  ArrowRight,
  TrendingDown,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileCheck,
  Edit3,
  Trash2,
  Megaphone,
  Bell,
  XCircle,
  Eye,
} from "lucide-react";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import { useLanguage } from "../../contexts/LanguageContext";
import { cn, formatCurrency } from "../../lib/utils";
import { doc, collection } from "../../api";
import { calculatePayrollDetails } from "../../lib/payrollUtils";
import { AuditTrailEntry } from "../../types";
import { getPenaltyManagers, checkPenaltyUserRole, calculateFutureDate, getGrievanceStatusInfo } from "../../utils/penaltyWorkflow";
import { sanitizeHtml } from "../../utils/sanitizeHtml";
import { RichTextEditor } from "../common/RichTextEditor";

export const Penalties: React.FC = () => {
  const { user, profile } = useAuth();
  const currentUser = profile || user;
  const {
    employees,
    penalties,
    transactions,
    adminDepartments,
    investigations = [],
    administrativeNotices = [],
    refreshData,
  } = useData();
  const { t, language } = useLanguage();
  const { canEdit, isSuperAdmin } = usePermissions();

  const isHRRole =
    isSuperAdmin ||
    [
      "Super Admin",
      "Admin",
      "HR",
      "HR Manager",
      "مدير الموارد البشرية",
      "مسؤول الموارد البشرية",
      "الموارد البشرية",
      "Legal",
      "الشؤون القانونية",
      "Executive Director",
      "General Manager",
      "CEO",
    ].includes(profile?.role || "") ||
    (profile as any)?.department === "Human Resources" ||
    (profile as any)?.department === "الموارد البشرية" ||
    (profile as any)?.department === "الشؤون القانونية" ||
    (profile as any)?.department === "Legal";

  const [activeTab, setActiveTab] = useState<
    "list" | "investigations" | "create" | "reports"
  >("list");
  const [invSubTab, setInvSubTab] = useState<"sessions" | "notices">(
    "sessions",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterViolationType, setFilterViolationType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Investigation Modal State
  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [invFormData, setInvFormData] = useState({
    title: "",
    reason: "",
    investigationDate: new Date().toISOString().split("T")[0],
    investigationTime: "10:00",
    location: "مكتب الشؤون القانونية",
    investigatorName: currentUser?.name || "المستشار القانوني",
    selectedEmployeeIds: [] as string[],
  });

  // Edit Investigation Modal State
  const [editInvModal, setEditInvModal] = useState<{
    isOpen: boolean;
    investigation: any;
    title: string;
    reason: string;
    investigationDate: string;
    investigationTime: string;
    location: string;
    investigatorName: string;
    selectedEmployeeIds: string[];
    saving: boolean;
  }>({
    isOpen: false,
    investigation: null,
    title: "",
    reason: "",
    investigationDate: "",
    investigationTime: "",
    location: "",
    investigatorName: "",
    selectedEmployeeIds: [],
    saving: false,
  });

  // Edit Notice Modal State
  const [editNoticeModal, setEditNoticeModal] = useState<{
    isOpen: boolean;
    notice: any;
    title: string;
    content: string;
    category: string;
    priority: string;
    noticeDate: string;
    targetAudience: string[];
    saving: boolean;
  }>({
    isOpen: false,
    notice: null,
    title: "",
    content: "",
    category: "general",
    priority: "normal",
    noticeDate: new Date().toISOString().split("T")[0],
    targetAudience: [],
    saving: false,
  });

  // Create Notice Modal State
  const [createNoticeModal, setCreateNoticeModal] = useState<{
    isOpen: boolean;
    title: string;
    content: string;
    category: string;
    priority: string;
    noticeDate: string;
    selectedEmployeeIds: string[];
    saving: boolean;
  }>({
    isOpen: false,
    title: "",
    content: "",
    category: "general",
    priority: "normal",
    noticeDate: new Date().toISOString().split("T")[0],
    selectedEmployeeIds: [],
    saving: false,
  });

  // View Notice Modal State
  const [viewNoticeModal, setViewNoticeModal] = useState<{
    isOpen: boolean;
    notice: any;
  }>({
    isOpen: false,
    notice: null,
  });

  // Handlers for Editing & Deleting Investigations
  const handleOpenEditInv = (inv: any) => {
    let empArr: string[] = [];
    try {
      empArr =
        typeof inv.employeeIds === "string"
          ? JSON.parse(inv.employeeIds)
          : inv.employeeIds || [];
    } catch (e) {}

    setEditInvModal({
      isOpen: true,
      investigation: inv,
      title: inv.title || "",
      reason: inv.reason || "",
      investigationDate:
        inv.investigationDate || new Date().toISOString().split("T")[0],
      investigationTime: inv.investigationTime || "10:00",
      location: inv.location || "مكتب الشؤون القانونية",
      investigatorName:
        inv.investigatorName || currentUser?.name || "المستشار القانوني",
      selectedEmployeeIds:
        empArr.length > 0 ? empArr : [inv.employeeId].filter(Boolean),
      saving: false,
    });
  };

  const handleUpdateInvestigation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInvModal.investigation) return;
    if (!editInvModal.title || editInvModal.selectedEmployeeIds.length === 0) {
      alert("يرجى تحديد عنوان التحقيق واختيار الموظفين المعنيين");
      return;
    }
    setEditInvModal((prev) => ({ ...prev, saving: true }));
    try {
      const selectedEmps = employees.filter(
        (e) =>
          editInvModal.selectedEmployeeIds.includes(e.id) ||
          editInvModal.selectedEmployeeIds.includes(e.employeeId),
      );
      const empNames = selectedEmps.map((e) => e.name).join(", ");

      const allAudienceSet = new Set<string>();
      const managerIds: string[] = [];

      selectedEmps.forEach((emp) => {
        [emp.id, emp.employeeId, emp.userId, emp.email]
          .filter(Boolean)
          .forEach((val) =>
            allAudienceSet.add(String(val).toLowerCase().trim()),
          );
        const mgrId = emp.managerId || emp.directManagerId;
        if (mgrId) {
          if (!managerIds.includes(mgrId)) managerIds.push(mgrId);
          allAudienceSet.add(String(mgrId).toLowerCase().trim());
          const mgrObj = employees.find(
            (e) =>
              e.id === mgrId ||
              e.employeeId === mgrId ||
              e.userId === mgrId ||
              e.email === mgrId,
          );
          if (mgrObj) {
            [mgrObj.id, mgrObj.employeeId, mgrObj.userId, mgrObj.email]
              .filter(Boolean)
              .forEach((val) =>
                allAudienceSet.add(String(val).toLowerCase().trim()),
              );
          }
        }
      });

      const allEmpIdentifiers = Array.from(allAudienceSet);

      const updatePayload = {
        title: editInvModal.title,
        reason: editInvModal.reason,
        investigationDate: editInvModal.investigationDate,
        investigationTime: editInvModal.investigationTime,
        location: editInvModal.location,
        investigatorName: editInvModal.investigatorName,
        employeeId:
          selectedEmps[0]?.id ||
          selectedEmps[0]?.employeeId ||
          editInvModal.selectedEmployeeIds[0] ||
          "",
        employeeIds: JSON.stringify(allEmpIdentifiers),
        employeeName: empNames,
        managerIds: JSON.stringify(managerIds),
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch(
        `/api/investigations/${editInvModal.investigation.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify(updatePayload),
        },
      );

      if (res.ok) {
        // Update matching notice if exists
        const matchingNotice = (administrativeNotices || []).find(
          (n: any) =>
            n.investigationId === editInvModal.investigation.id ||
            (n.title && n.title.includes(editInvModal.investigation.title)),
        );

        if (matchingNotice) {
          const noticeTitle = `استدعاء جلسة تحقيق إداري - ${editInvModal.title}`;
          const noticeContent = `<div style="direction: rtl; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; border-radius: 12px; background-color: #ffffff; border: 2px solid #ef4444; color: #111827; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h3 style="color: #dc2626; margin-top: 0; margin-bottom: 12px; font-weight: 900; font-size: 16px; border-bottom: 2px solid #fee2e2; padding-bottom: 8px;">📋 استدعاء جلسة تحقيق إداري رسمية</h3>
            <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">الموظف المدعو لحضور التحقيق:</strong> <span style="color: #dc2626; font-weight: 800;">${empNames}</span></p>
            <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">موضوع التحقيق:</strong> <span style="color: #1f2937; font-weight: 700;">${editInvModal.title}</span></p>
            <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">سبب التحقيق والتفاصيل:</strong> <span style="color: #374151;">${editInvModal.reason || "مراجعة الملاحظات الإدارية والقانونية"}</span></p>
            <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">موعد الجلسة:</strong> <span style="color: #111827; font-weight: 700;">${editInvModal.investigationDate} في تمام الساعة ${editInvModal.investigationTime}</span></p>
            <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">مكان / مقر التحقيق:</strong> <span style="color: #374151;">${editInvModal.location || "الشؤون القانونية"}</span></p>
            <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">المحقق / المستشار المسؤول:</strong> <span style="color: #374151;">${editInvModal.investigatorName || "المستشار القانوني"}</span></p>
            <hr style="margin: 12px 0; border: none; border-top: 1px dashed #fca5a5;"/>
            <p style="color: #991b1b; font-size: 12px; font-weight: 800; margin: 0; background-color: #fef2f2; padding: 10px; border-radius: 8px; border: 1px solid #fecaca; text-align: center;">⚠️ تنبيه هـام: يرجى من الموظف المدعو الالتزام بالحضور والتواجد في المكان والزمان المحددين أعلاه.</p>
          </div>`;

          await fetch(`/api/administrative-notices/${matchingNotice.id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
            },
            body: JSON.stringify({
              title: noticeTitle,
              content: noticeContent,
              noticeDate: editInvModal.investigationDate,
              targetAudience: allEmpIdentifiers,
              updatedAt: new Date().toISOString(),
            }),
          });
        }

        await refreshData();
        setEditInvModal((prev) => ({
          ...prev,
          isOpen: false,
          investigation: null,
        }));
        alert("تم تعديل جلسة التحقيق بنجاح");
      } else {
        alert("حدث خطأ أثناء تعديل التحقيق");
      }
    } catch (err: any) {
      console.error("Error updating investigation:", err);
      alert("خطأ: " + err.message);
    } finally {
      setEditInvModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleDeleteInvestigation = async (invId: string) => {
    if (
      !window.confirm(
        "هل أنت متاكد من رغبتك في مسح / حذف جلسة التحقيق الإداري هذه والتنبيه الموجه المرتبط بها؟",
      )
    )
      return;
    try {
      const res = await fetch(`/api/investigations/${invId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (res.ok) {
        await refreshData();
        alert("تم مسح جلسة التحقيق والتنبيه المرتبط بها بنجاح");
      } else {
        alert("حدث خطأ أثناء مسح التحقيق");
      }
    } catch (err: any) {
      console.error("Error deleting investigation:", err);
      alert("خطأ أثناء مسح التحقيق: " + err.message);
    }
  };

  // Handlers for Editing & Deleting Administrative Notices
  const handleOpenEditNotice = (notice: any) => {
    setEditNoticeModal({
      isOpen: true,
      notice: notice,
      title: notice.title || "",
      content: notice.content || "",
      category: notice.category || "general",
      priority: notice.priority || "normal",
      noticeDate: notice.noticeDate || new Date().toISOString().split("T")[0],
      targetAudience: Array.isArray(notice.targetAudience)
        ? notice.targetAudience
        : [],
      saving: false,
    });
  };

  const handleUpdateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNoticeModal.notice) return;
    setEditNoticeModal((prev) => ({ ...prev, saving: true }));
    try {
      const res = await fetch(
        `/api/administrative-notices/${editNoticeModal.notice.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify({
            title: editNoticeModal.title,
            content: editNoticeModal.content,
            category: editNoticeModal.category,
            priority: editNoticeModal.priority,
            noticeDate: editNoticeModal.noticeDate,
            targetAudience: editNoticeModal.targetAudience,
            updatedAt: new Date().toISOString(),
          }),
        },
      );

      if (res.ok) {
        await refreshData();
        setEditNoticeModal((prev) => ({
          ...prev,
          isOpen: false,
          notice: null,
        }));
        alert("تم تعديل التنبيه الإداري الموجه بنجاح");
      } else {
        alert("حدث خطأ أثناء تعديل التنبيه الإداري");
      }
    } catch (err: any) {
      alert("خطأ: " + err.message);
    } finally {
      setEditNoticeModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    if (
      !window.confirm(
        "هل أنت متاكد من رغبتك في مسح / حذف هذا التنبيه الإداري الموجه؟",
      )
    )
      return;
    try {
      const res = await fetch(`/api/administrative-notices/${noticeId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (res.ok) {
        await refreshData();
        alert("تم مسح التنبيه الإداري بنجاح");
      } else {
        alert("حدث خطأ أثناء مسح التنبيه الإداري");
      }
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const handleCreateNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createNoticeModal.title || !createNoticeModal.content) {
      alert("يرجى كتابة عنوان التنبيه ومحتوى التنبيه");
      return;
    }
    setCreateNoticeModal((prev) => ({ ...prev, saving: true }));
    try {
      const selectedEmps = employees.filter(
        (e) =>
          createNoticeModal.selectedEmployeeIds.includes(e.id) ||
          createNoticeModal.selectedEmployeeIds.includes(e.employeeId),
      );
      const targetAudienceSet = new Set<string>();

      selectedEmps.forEach((emp) => {
        [emp.id, emp.employeeId, emp.userId, emp.email]
          .filter(Boolean)
          .forEach((val) =>
            targetAudienceSet.add(String(val).toLowerCase().trim()),
          );
        const mgrId = emp.managerId || emp.directManagerId;
        if (mgrId) {
          targetAudienceSet.add(String(mgrId).toLowerCase().trim());
          const mgrObj = employees.find(
            (e) =>
              e.id === mgrId ||
              e.employeeId === mgrId ||
              e.userId === mgrId ||
              e.email === mgrId,
          );
          if (mgrObj) {
            [mgrObj.id, mgrObj.employeeId, mgrObj.userId, mgrObj.email]
              .filter(Boolean)
              .forEach((val) =>
                targetAudienceSet.add(String(val).toLowerCase().trim()),
              );
          }
        }
      });

      const audience =
        createNoticeModal.selectedEmployeeIds.length === 0
          ? ["all"]
          : Array.from(targetAudienceSet);

      const res = await fetch("/api/administrative-notices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          title: createNoticeModal.title,
          content: createNoticeModal.content,
          category: createNoticeModal.category,
          priority: createNoticeModal.priority,
          noticeDate: createNoticeModal.noticeDate,
          targetAudience: audience,
          createdByName: currentUser?.name || "الإدارة العامة",
          createdByRole: "الإدارة",
          createdById: profile?.id || user?.uid || "",
          status: "Published",
        }),
      });

      if (res.ok) {
        await refreshData();
        setCreateNoticeModal({
          isOpen: false,
          title: "",
          content: "",
          category: "general",
          priority: "normal",
          noticeDate: new Date().toISOString().split("T")[0],
          selectedEmployeeIds: [],
          saving: false,
        });
        alert("تم إنشاء ونشر التنبيه الإداري الموجه بنجاح");
      } else {
        alert("حدث خطأ أثناء إنشاء التنبيه الإداري");
      }
    } catch (err: any) {
      alert("خطأ: " + err.message);
    } finally {
      setCreateNoticeModal((prev) => ({ ...prev, saving: false }));
    }
  };

  // Investigation Result Modal State
  const [invResultModal, setInvResultModal] = useState<{
    isOpen: boolean;
    investigation: any;
    recommendation: string;
    notes: string;
    status: "Completed" | "Scheduled" | "Cancelled";
    saving: boolean;
  }>({
    isOpen: false,
    investigation: null,
    recommendation: "",
    notes: "",
    status: "Completed",
    saving: false,
  });

  const handleOpenResultModal = (inv: any) => {
    setInvResultModal({
      isOpen: true,
      investigation: inv,
      recommendation: inv.recommendation || "",
      notes: inv.notes || "",
      status:
        (inv.status as "Completed" | "Scheduled" | "Cancelled") || "Completed",
      saving: false,
    });
  };

  const handleSaveInvResult = async () => {
    if (!invResultModal.investigation) return;
    if (!isHRRole) {
      alert(
        "عذراً، تقتصر صلاحية إدخال وتوثيق نتائج التحقيق والقرارات الصادرة على مسؤول الموارد البشرية والشؤون القانونية فقط.",
      );
      return;
    }
    setInvResultModal((prev) => ({ ...prev, saving: true }));
    try {
      const invId = invResultModal.investigation.id;
      const res = await fetch(`/api/investigations/${invId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          recommendation: invResultModal.recommendation,
          notes: invResultModal.notes,
          status: invResultModal.status,
        }),
      });

      if (res.ok) {
        await refreshData();
        setInvResultModal({
          isOpen: false,
          investigation: null,
          recommendation: "",
          notes: "",
          status: "Completed",
          saving: false,
        });
        alert("تم حفظ نتيجة التحقيق والقرارات الصادرة بنجاح!");
      } else {
        alert("حدث خطأ أثناء حفظ نتيجة التحقيق");
        setInvResultModal((prev) => ({ ...prev, saving: false }));
      }
    } catch (err: any) {
      alert("خطأ: " + err.message);
      setInvResultModal((prev) => ({ ...prev, saving: false }));
    }
  };
  // Selected Penalty for Details/Popup
  const [viewingPenalty, setViewingPenalty] = useState<any>(null);
  const [editingPenaltyId, setEditingPenaltyId] = useState<string | null>(null);

  const [returnDialogState, setReturnDialogState] = useState<{
    isOpen: boolean;
    penalty: any;
    type: "Returned" | "Rejected";
    reason: string;
  }>({
    isOpen: false,
    penalty: null,
    type: "Returned",
    reason: "",
  });

  // HR Grievance Review State
  const [grievanceReviewModal, setGrievanceReviewModal] = useState<{
    isOpen: boolean;
    penalty: any;
    action: "Accepted_Modified" | "Rejected";
    newPenaltyType: string;
    newDeductionType: "Amount" | "Days" | null;
    newDeductionValue: number;
    reply: string;
    saving: boolean;
  }>({
    isOpen: false,
    penalty: null,
    action: "Accepted_Modified",
    newPenaltyType: "Warning",
    newDeductionType: null,
    newDeductionValue: 0,
    reply: "",
    saving: false,
  });

  const handleOpenGrievanceReview = (penalty: any) => {
    setGrievanceReviewModal({
      isOpen: true,
      penalty,
      action: "Accepted_Modified",
      newPenaltyType: penalty.penaltyType || "Warning",
      newDeductionType: penalty.deductionType || null,
      newDeductionValue: penalty.deductionValue || 0,
      reply: "",
      saving: false,
    });
  };

  useEffect(() => {
    const handleOpenReviewEvent = (e: any) => {
      const penaltyId = e.detail?.penaltyId;
      if (penaltyId && penalties && penalties.length > 0) {
        const found = penalties.find((p: any) => String(p.id) === String(penaltyId) || String(p.penaltyNumber) === String(penaltyId));
        if (found) {
          setActiveTab("list");
          handleOpenGrievanceReview(found);
        }
      }
    };
    window.addEventListener("open_grievance_review", handleOpenReviewEvent);
    return () => window.removeEventListener("open_grievance_review", handleOpenReviewEvent);
  }, [penalties]);

  const handleProcessGrievance = async () => {
    if (!grievanceReviewModal.penalty || !grievanceReviewModal.reply.trim()) {
      alert("يرجى كتابة سبب وتفاصيل قرار إدارة الموارد البشرية بشأن التظلم");
      return;
    }
    setGrievanceReviewModal((prev) => ({ ...prev, saving: true }));
    try {
      const pen = grievanceReviewModal.penalty;
      const isAccepted = grievanceReviewModal.action === "Accepted_Modified";
      const currentUserDisplayName = currentUser?.name || user?.email || "إدارة الموارد البشرية";
      const existingAudit = Array.isArray(pen.auditTrail) ? pen.auditTrail : [];
      
      const newAuditEntry: AuditTrailEntry = {
        timestamp: new Date().toISOString(),
        userName: currentUserDisplayName,
        action: isAccepted ? "قبول التظلم وتعديل الجزاء" : "رفض التظلم والإبقاء على الجزاء",
        comment: grievanceReviewModal.reply.trim(),
        previousStatus: pen.status,
        newStatus: pen.status,
      };

      const updatedPayload: any = {
        grievanceStatus: grievanceReviewModal.action,
        grievanceReply: grievanceReviewModal.reply.trim(),
        grievanceReviewedAt: new Date().toISOString(),
        grievanceReviewedBy: currentUserDisplayName,
        auditTrail: [...existingAudit, newAuditEntry],
        updatedAt: new Date().toISOString(),
      };

      if (isAccepted) {
        updatedPayload.preGrievancePenaltyType = pen.preGrievancePenaltyType || pen.penaltyType;
        updatedPayload.preGrievanceDeductionType = pen.preGrievanceDeductionType || pen.deductionType;
        updatedPayload.preGrievanceDeductionValue = pen.preGrievanceDeductionValue ?? pen.deductionValue;
        
        updatedPayload.postGrievancePenaltyType = grievanceReviewModal.newPenaltyType;
        updatedPayload.postGrievanceDeductionType = grievanceReviewModal.newPenaltyType === "Amount Deduction" ? "Amount" : grievanceReviewModal.newPenaltyType === "Day Deduction" ? "Days" : null;
        updatedPayload.postGrievanceDeductionValue = ["Amount Deduction", "Day Deduction"].includes(grievanceReviewModal.newPenaltyType) ? Number(grievanceReviewModal.newDeductionValue) || 0 : 0;
        
        updatedPayload.penaltyType = updatedPayload.postGrievancePenaltyType;
        updatedPayload.deductionType = updatedPayload.postGrievanceDeductionType;
        updatedPayload.deductionValue = updatedPayload.postGrievanceDeductionValue;
      }

      const res = await fetch(`/api/penalties/${pen.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(updatedPayload),
      });

      if (!res.ok) {
        throw new Error("Failed to process grievance");
      }

      // Notify the employee of the HR decision
      const empTargetId = pen.employeeId || pen.userId;
      if (empTargetId) {
        try {
          await fetch('/api/dashboard-notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            },
            body: JSON.stringify({
              id: `notif-grievance-res-${pen.id}-${Date.now()}`,
              employeeId: empTargetId,
              title: isAccepted ? 'قبول تظلمك الإداري وتعديل الجزاء' : 'قرار إدارة الموارد البشرية بشأن تظلمك',
              message: isAccepted 
                ? `تمت مراجعة تظلمك على الجزاء رقم (${pen.penaltyNumber || pen.id}) وقبوله وتعديل الجزاء إلى (${updatedPayload.penaltyType}). قرار الموارد البشرية: "${grievanceReviewModal.reply.trim()}"`
                : `تمت مراجعة تظلمك على الجزاء رقم (${pen.penaltyNumber || pen.id}) وقررت إدارة الموارد البشرية الإبقاء على الجزاء. ملاحظات: "${grievanceReviewModal.reply.trim()}"`,
              notificationType: 'grievance',
              relatedEntityType: 'penalties',
              relatedEntityId: pen.id,
              isRead: false,
              createdAt: new Date().toISOString()
            })
          });
        } catch (notErr) {}
      }

      const updatedPenaltyObj = { ...pen, ...updatedPayload };
      await sendPenaltyNotice(updatedPenaltyObj);
      await refreshData();
      
      setGrievanceReviewModal({
        isOpen: false,
        penalty: null,
        action: "Accepted_Modified",
        newPenaltyType: "Warning",
        newDeductionType: null,
        newDeductionValue: 0,
        reply: "",
        saving: false,
      });

      if (viewingPenalty && viewingPenalty.id === pen.id) {
        setViewingPenalty(updatedPenaltyObj);
      }

      alert(isAccepted ? "تم قبول التظلم وتعديل الجزاء بنجاح" : "تم رفض التظلم والإبقاء على الجزاء الأصلي");
    } catch (err: any) {
      alert("خطأ: " + err.message);
    } finally {
      setGrievanceReviewModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const sendPenaltyNotice = async (penalty: any) => {
    try {
      const emp = employees.find((e) => e.id === penalty.employeeId || e.employeeId === penalty.employeeId);
      const empName = emp?.name || penalty.employeeName || "الموظف المعني";
      const violationTypeName = getViolationTypeName(penalty.violationType);
      const penaltyTypeName = getPenaltyTypeName(penalty.penaltyType);
      const noticeTitle = `قرار جزاء إداري رقم ${penalty.penaltyNumber || penalty.id}: ${violationTypeName}`;
      
      const { directMgr, higherMgr, targetEmp } = getPenaltyManagers(penalty, employees);

      const audienceSet = new Set<string>();
      if (penalty.employeeId) audienceSet.add(String(penalty.employeeId).toLowerCase().trim());
      if (targetEmp?.id) audienceSet.add(String(targetEmp.id).toLowerCase().trim());
      if (targetEmp?.employeeId) audienceSet.add(String(targetEmp.employeeId).toLowerCase().trim());
      if (targetEmp?.userId) audienceSet.add(String(targetEmp.userId).toLowerCase().trim());
      if (targetEmp?.email) audienceSet.add(String(targetEmp.email).toLowerCase().trim());

      if (directMgr) {
        [directMgr.id, directMgr.employeeId, directMgr.userId, directMgr.email]
          .filter(Boolean)
          .forEach(x => audienceSet.add(String(x).toLowerCase().trim()));
      }
      if (higherMgr) {
        [higherMgr.id, higherMgr.employeeId, higherMgr.userId, higherMgr.email]
          .filter(Boolean)
          .forEach(x => audienceSet.add(String(x).toLowerCase().trim()));
      }

      const noticeContent = `<p><strong>السيد/ة ${empName} المحترم/ة،</strong></p>` +
        `<p>إشارة إلى السجل الإداري، نفيدكم بصدور/تحديث قرار جزاء إداري رقم <strong>${penalty.penaltyNumber || penalty.id}</strong> بشأن مخالفة: <strong>${violationTypeName}</strong> بتاريخ ${penalty.violationDate}.</p>` +
        `<p><strong>نوع الإجراء / الجزاء:</strong> ${penaltyTypeName}</p>` +
        (penalty.deductionValue > 0 ? `<p><strong>قيمة الخصم:</strong> ${penalty.deductionValue} ${penalty.deductionType === 'Days' ? 'أيام' : 'جنيه مصري'}</p>` : '') +
        `<p><strong>تفاصيل القرار:</strong> ${penalty.description || 'لا توجد تفاصيل إضافية'}</p>` +
        `<p><strong>حالة القرار الحالية:</strong> ${getStatusName(penalty.status)}</p>` +
        (penalty.directManagerObjectionReason ? `<p style="color: #d97706;"><strong>سبب اعتراض المدير المباشر:</strong> ${penalty.directManagerObjectionReason}</p>` : '') +
        (penalty.higherManagerObjectionReason ? `<p style="color: #d97706;"><strong>سبب اعتراض الرئيس الأعلى:</strong> ${penalty.higherManagerObjectionReason}</p>` : '') +
        (penalty.rejectionReason ? `<p style="color: #dc2626;"><strong>سبب الرفض:</strong> ${penalty.rejectionReason}</p>` : '');

      const noticePayload = {
        id: `NOTICE-PEN-${penalty.id}`,
        title: noticeTitle,
        category: 'decision',
        priority: 'urgent',
        noticeDate: penalty.penaltyDate || new Date().toISOString().split('T')[0],
        startDate: penalty.penaltyDate || new Date().toISOString().split('T')[0],
        durationDays: 30,
        isPermanent: false,
        content: noticeContent,
        targetAudience: Array.from(audienceSet),
        status: 'Published',
        readBy: [],
        createdById: (profile as any)?.id || user?.uid || 'system',
        createdByName: currentUser?.name || profile?.name || user?.email || 'الشؤون القانونية والموارد البشرية',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await fetch(`/api/administrative-notices/${noticePayload.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(noticePayload),
      });
    } catch (err) {
      console.error("Error creating penalty administrative notice:", err);
    }
  };

  const handleDeletePenalty = async (pen: any) => {
    if (!confirm(`هل أنت تأكد من حذف الجزاء رقم ${pen.penaltyNumber || pen.id} نهائياً؟`)) {
      return;
    }
    try {
      const res = await fetch(`/api/penalties/${pen.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to delete penalty");
      }
      alert(language === "ar" ? "تم حذف الجزاء بنجاح" : "Penalty deleted successfully");
      await refreshData();
    } catch (err: any) {
      alert((language === "ar" ? "فشل حذف الجزاء: " : "Failed to delete penalty: ") + err.message);
    }
  };

  const handleCancelOrSuspendPenalty = async (pen: any) => {
    const reason = prompt("يرجى إدخال سبب إلغاء أو إيقاف الجزاء الإداري:");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("يرجى إدخال سبب الإلغاء أو الإيقاف للاستمرار.");
      return;
    }
    try {
      const currentUserDisplayName = currentUser?.name || user?.email || "المراجع الإداري";
      const existingAudit = Array.isArray(pen.auditTrail) ? pen.auditTrail : [];
      const newAuditEntry: AuditTrailEntry = {
        timestamp: new Date().toISOString(),
        userName: currentUserDisplayName,
        action: "إلغاء / إيقاف الجزاء",
        comment: reason.trim(),
        previousStatus: pen.status,
        newStatus: "Cancelled",
      };

      const updatedPayload = {
        status: "Cancelled",
        cancellationReason: reason.trim(),
        auditTrail: [...existingAudit, newAuditEntry],
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch(`/api/penalties/${pen.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(updatedPayload),
      });

      if (!res.ok) {
        throw new Error("Failed to cancel penalty");
      }

      await sendPenaltyNotice({ ...pen, status: "Cancelled", description: `تم إلغاء/إيقاف الجزاء: ${reason.trim()}` });
      await refreshData();
      alert(language === "ar" ? "تم إلغاء / إيقاف الجزاء بنجاح" : "Penalty cancelled successfully");
    } catch (err: any) {
      alert((language === "ar" ? "فشل إيقاف الجزاء: " : "Failed to cancel penalty: ") + err.message);
    }
  };

  const handleStartEdit = (pen: any) => {
    setEditingPenaltyId(pen.id);
    setFormData({
      employeeId: pen.employeeId || "",
      violationDate:
        pen.violationDate || new Date().toISOString().split("T")[0],
      penaltyDate: pen.penaltyDate || new Date().toISOString().split("T")[0],
      violationType: pen.violationType || "Delay",
      description: pen.description || "",
      attachmentUrl: pen.attachmentUrl || "",
      penaltyType: pen.penaltyType || "Warning",
      deductionType: pen.deductionType || "Amount",
      deductionValue: pen.deductionValue || 0,
      targetMonth: pen.targetMonth || new Date().toISOString().slice(0, 7),
      adminNotes: pen.adminNotes || "",
      employeeNotes: pen.employeeNotes || "",
      disciplinaryApprovalType:
        pen.disciplinaryApprovalType ||
        pen.disciplinary_approval_type ||
        "Approved by Direct Manager",
      referenceNumber: pen.referenceNumber || pen.reference_number || "",
      grievanceWindowDays: Number(pen.grievanceWindowDays) > 0 ? Number(pen.grievanceWindowDays) : 7,
      visibilityDurationDays: Number(pen.visibilityDurationDays) > 0 ? Number(pen.visibilityDurationDays) : 30,
    });
    setActiveTab("create");
  };

  // Form State for Dynamic Add
  const [formData, setFormData] = useState({
    employeeId: "",
    violationDate: new Date().toISOString().split("T")[0],
    penaltyDate: new Date().toISOString().split("T")[0],
    violationType: "Delay",
    description: "",
    attachmentUrl: "",
    penaltyType: "Warning",
    deductionType: "Amount",
    deductionValue: 0,
    targetMonth: new Date().toISOString().slice(0, 7),
    adminNotes: "",
    employeeNotes: "",
    disciplinaryApprovalType: "Approved by Direct Manager",
    referenceNumber: "",
    grievanceWindowDays: 7,
    visibilityDurationDays: 30,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reports Filter state
  const [reportType, setReportType] = useState<
    "all" | "financial" | "payroll" | "timeframe"
  >("all");
  const [reportStartDate, setReportStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
  );
  const [reportEndDate, setReportEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId) {
      alert(
        language === "ar"
          ? t("يرجى اختيار الموظف أولاً")
          : "Please select an employee first",
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedEmployee = employees.find(
        (emp) => emp.id === formData.employeeId,
      );
      const deptId = selectedEmployee?.departmentId || null;

      let penaltyId = editingPenaltyId;
      let penaltyNumber = "";
      let originalCreatedAt = new Date().toISOString();
      const isEditing = !!editingPenaltyId;

      if (!isEditing) {
        const prefix = "PEN-";
        const count = penalties.length + 1;
        penaltyNumber = `${prefix}${new Date().getFullYear().toString().slice(-2)}${String(count).padStart(4, "0")}`;
        penaltyId = doc(collection(null as any, "penalties")).id;
      } else {
        const existing = penalties.find((p) => p.id === editingPenaltyId);
        penaltyNumber = existing?.penaltyNumber || "PEN-UPDATED";
        originalCreatedAt = existing?.createdAt || new Date().toISOString();
      }

      const refNum =
        formData.referenceNumber ||
        `REF-${new Date().getFullYear()}-${String(penalties.length + 1).padStart(4, "0")}`;
      const isTopManagement =
        formData.disciplinaryApprovalType === "Issued by Top Management";
      const initialStatus = isTopManagement
        ? "Approved"
        : "Pending Direct Manager";
      const currentUserDisplayName =
        currentUser?.name || user?.email || "مستخدم النظام";

      const initialAudit: AuditTrailEntry[] = [
        {
          timestamp: new Date().toISOString(),
          userName: currentUserDisplayName,
          action: isEditing ? "تعديل الجزاء" : "إنشاء وتوثيق المخالفة",
          comment: isTopManagement
            ? "جزاء صادر مباشرة من الإدارة العليا (معتمد تلقائياً)"
            : "جزاء يتطلب موافقة المدير المباشر ثم الرئيس الأعلى",
          newStatus: initialStatus,
        },
      ];

      const existingPen = penalties.find((p) => p.id === editingPenaltyId);
      const auditTrail =
        isEditing &&
        existingPen?.auditTrail &&
        Array.isArray(existingPen.auditTrail)
          ? [...existingPen.auditTrail, ...initialAudit]
          : initialAudit;

      const gWinDays = Math.max(1, Number(formData.grievanceWindowDays) || 7);
      const vDurDays = Math.max(1, Number(formData.visibilityDurationDays) || 30);
      const grievanceStartDate = formData.penaltyDate || new Date().toISOString().split("T")[0];
      const grievanceDeadlineDate = calculateFutureDate(grievanceStartDate, gWinDays);
      const visibilityEndDate = calculateFutureDate(grievanceStartDate, vDurDays);

      const newPenalty = {
        penaltyNumber,
        referenceNumber: refNum,
        disciplinaryApprovalType: formData.disciplinaryApprovalType,
        employeeId: formData.employeeId,
        departmentId: deptId,
        violationDate: formData.violationDate,
        penaltyDate: formData.penaltyDate,
        violationType: formData.violationType,
        description: formData.description,
        attachmentUrl: formData.attachmentUrl || null,
        penaltyType: formData.penaltyType,
        deductionType:
          formData.penaltyType === "Amount Deduction"
            ? "Amount"
            : formData.penaltyType === "Day Deduction"
              ? "Days"
              : null,
        deductionValue: ["Amount Deduction", "Day Deduction"].includes(
          formData.penaltyType,
        )
          ? Number(formData.deductionValue) || 0
          : 0,
        targetMonth: ["Amount Deduction", "Day Deduction"].includes(
          formData.penaltyType,
        )
          ? formData.targetMonth
          : null,
        fiscalYear: new Date(formData.penaltyDate).getFullYear().toString(),
        submitterId: null,
        approverId: null,
        status: initialStatus,
        adminNotes: formData.adminNotes || "",
        employeeNotes: formData.employeeNotes || "",
        grievanceWindowDays: gWinDays,
        visibilityDurationDays: vDurDays,
        grievanceStartDate,
        grievanceDeadlineDate,
        visibilityEndDate,
        auditTrail,
        createdAt: originalCreatedAt,
        updatedAt: new Date().toISOString(),
      };

      const response = await fetch(`/api/penalties/${penaltyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(newPenalty),
      });

      if (!response.ok) {
        throw new Error("API request failed");
      }

      // If financial penalty and issued directly by Top Management (Approved), apply payroll deduction automatically
      if (
        initialStatus === "Approved" &&
        ["Amount Deduction", "Day Deduction"].includes(formData.penaltyType)
      ) {
        await applyPenaltyToPayroll(newPenalty);
      }

      await sendPenaltyNotice({ ...newPenalty, id: penaltyId });
      await refreshData();
      alert(
        language === "ar"
          ? t("تم حفظ وتحديث الجزاء بنجاح")
          : "Violation penalty saved and updated successfully",
      );

      setEditingPenaltyId(null);
      setFormData({
        employeeId: "",
        violationDate: new Date().toISOString().split("T")[0],
        penaltyDate: new Date().toISOString().split("T")[0],
        violationType: "Delay",
        description: "",
        attachmentUrl: "",
        penaltyType: "Warning",
        deductionType: "Amount",
        deductionValue: 0,
        targetMonth: new Date().toISOString().slice(0, 7),
        adminNotes: "",
        employeeNotes: "",
        disciplinaryApprovalType: "Approved by Direct Manager",
        referenceNumber: "",
        grievanceWindowDays: 7,
        visibilityDurationDays: 30,
      });
      setActiveTab("list");
    } catch (err: any) {
      console.error(err);
      alert(
        language === "ar"
          ? t("فشل في الحفظ:")
          : "Failed to save: " + err.message,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Approval Flow and Auto-Creation/Modification of payroll monthly transaction
  const handleUpdateStatus = async (
    penalty: any,
    action: "Approved" | "Returned" | "Rejected",
    reasonText?: string,
  ) => {
    try {
      const currentUserDisplayName =
        currentUser?.name || user?.email || "المراجع الإداري";
      const existingAudit = Array.isArray(penalty.auditTrail)
        ? penalty.auditTrail
        : [];

      const { directMgr, higherMgr, hasHigherManager, targetEmp } = getPenaltyManagers(penalty, employees);

      let nextStatus: string = penalty.status;
      let actionName = "";
      const extraFields: any = {};

      const currentStatus = penalty.status || "Pending Direct Manager";

      // 1. Direct Manager Stage
      if (["Pending Direct Manager", "Pending Approval", "Draft", "Pending"].includes(currentStatus)) {
        if (action === "Approved") {
          nextStatus = hasHigherManager ? "Pending Higher Manager" : "Pending HR";
          actionName = hasHigherManager
            ? "موافقة المدير المباشر (إحالة للرئيس الأعلى)"
            : "موافقة المدير المباشر (إحالة للموارد البشرية - لا يوجد رئيس أعلى للمدير المباشر)";
          extraFields.directManagerDecision = "Approved";
        } else {
          // Objected by Direct Manager -> MUST move to Higher Manager / HR with objection note!
          if (!reasonText || !reasonText.trim()) {
            alert(t("يرجى إلزامياً كتابة سبب الاعتراض للمتابعة"));
            return;
          }
          nextStatus = hasHigherManager ? "Pending Higher Manager" : "Pending HR";
          actionName = hasHigherManager
            ? "اعتراض المدير المباشر (إحالة للرئيس الأعلى للبت)"
            : "اعتراض المدير المباشر (إحالة للموارد البشرية للقرار النهائي - لا يوجد رئيس أعلى للمدير المباشر)";
          extraFields.directManagerDecision = "Objected";
          extraFields.directManagerObjectionReason = reasonText.trim();
        }
      }
      // 2. Higher Manager Stage
      else if (currentStatus === "Pending Higher Manager") {
        if (action === "Approved") {
          nextStatus = "Pending HR";
          actionName = "موافقة الرئيس الأعلى (إحالة للموارد البشرية)";
          extraFields.higherManagerDecision = "Approved";
        } else {
          // Objected by Higher Manager -> MUST move to HR with objection note!
          if (!reasonText || !reasonText.trim()) {
            alert(t("يرجى إلزامياً كتابة سبب الاعتراض للمتابعة"));
            return;
          }
          nextStatus = "Pending HR";
          actionName = "اعتراض الرئيس الأعلى (إحالة للموارد البشرية للقرار النهائي)";
          extraFields.higherManagerDecision = "Objected";
          extraFields.higherManagerObjectionReason = reasonText.trim();
        }
      }
      // 3. HR / Final Decision Stage
      else {
        if (action === "Approved") {
          nextStatus = "Approved";
          actionName = "اعتماد نهائي من الموارد البشرية";
          extraFields.hrDecision = "Approved";
          const approvalDate = new Date().toISOString().split("T")[0];
          const gWinDays = Number(penalty.grievanceWindowDays) > 0 ? Number(penalty.grievanceWindowDays) : 7;
          const vDurDays = Number(penalty.visibilityDurationDays) > 0 ? Number(penalty.visibilityDurationDays) : 30;
          extraFields.grievanceStartDate = penalty.grievanceStartDate || approvalDate;
          extraFields.grievanceDeadlineDate = penalty.grievanceDeadlineDate || calculateFutureDate(extraFields.grievanceStartDate, gWinDays);
          extraFields.visibilityEndDate = penalty.visibilityEndDate || calculateFutureDate(extraFields.grievanceStartDate, vDurDays);
        } else if (action === "Returned") {
          if (!reasonText || !reasonText.trim()) {
            alert(t("يرجى كتابة سبب الإعادة للمراجعة للمتابعة"));
            return;
          }
          nextStatus = "Returned";
          actionName = "إعادة الجزاء للمراجعة والتعديل";
          extraFields.returnReason = reasonText.trim();
        } else {
          if (!reasonText || !reasonText.trim()) {
            alert(t("يرجى كتابة سبب الرفض النهائياً للمتابعة"));
            return;
          }
          nextStatus = "Rejected";
          actionName = "رفض نهائي من الموارد البشرية";
          extraFields.hrDecision = "Rejected";
          extraFields.rejectionReason = reasonText.trim();
        }
      }

      const newAuditEntry: AuditTrailEntry = {
        timestamp: new Date().toISOString(),
        userName: currentUserDisplayName,
        action: actionName,
        comment:
          reasonText ||
          (nextStatus === "Approved"
            ? "تم اعتماد قرار الجزاء رسمياً"
            : nextStatus === "Pending Higher Manager"
              ? "بانتظار موافقة الرئيس الأعلى"
              : nextStatus === "Pending HR"
                ? "بانتظار قرار الموارد البشرية النهائي"
                : ""),
        previousStatus: penalty.status,
        newStatus: nextStatus,
      };

      const updatedPayload: any = {
        status: nextStatus,
        ...extraFields,
        auditTrail: [...existingAudit, newAuditEntry],
        updatedAt: new Date().toISOString(),
      };

      // Calc financial deduction if final approved
      if (nextStatus === "Approved") {
        await applyPenaltyToPayroll(penalty);
      }

      const response = await fetch(`/api/penalties/${penalty.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(updatedPayload),
      });

      if (!response.ok) {
        throw new Error("Failed to update penalty status");
      }

      const fullUpdatedPenalty = { ...penalty, ...updatedPayload };
      await sendPenaltyNotice(fullUpdatedPenalty);
      await refreshData();
      setViewingPenalty(null);
      setReturnDialogState({
        isOpen: false,
        penalty: null,
        type: "Returned",
        reason: "",
      });
      alert(
        language === "ar"
          ? t("تم تحديث حالة قرار الجزاء بنجاح")
          : "Penalty decision status updated successfully",
      );
    } catch (err: any) {
      console.error(err);
      alert(
        language === "ar"
          ? t("فشل في تعديل حالة الجزاء:")
          : "Failed to modify penalty status: " + err.message,
      );
    }
  };

  const handleCreateInvestigationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invFormData.title || invFormData.selectedEmployeeIds.length === 0) {
      alert("يرجى كتابة عنوان التحقيق واختيار الموظفين المعنيين على الأقل");
      return;
    }

    try {
      const invCount = (investigations || []).length + 1;
      const invNum = `INV-${new Date().getFullYear()}-${String(invCount).padStart(4, "0")}`;

      // Get manager IDs & all identifiers for selected employees
      const managerIds: string[] = [];
      const selectedEmps = employees.filter((e) =>
        invFormData.selectedEmployeeIds.some(
          (selId) =>
            String(selId).trim().toLowerCase() ===
              String(e.id).trim().toLowerCase() ||
            String(selId).trim().toLowerCase() ===
              String(e.employeeId || "")
                .trim()
                .toLowerCase() ||
            String(selId).trim().toLowerCase() ===
              String(e.userId || "")
                .trim()
                .toLowerCase() ||
            String(selId).trim().toLowerCase() ===
              String(e.email || "")
                .trim()
                .toLowerCase(),
        ),
      );
      const empNames = selectedEmps.map((e) => e.name).join(", ");

      const allEmpIdentifiersSet = new Set<string>();
      invFormData.selectedEmployeeIds.forEach((id) =>
        allEmpIdentifiersSet.add(String(id).toLowerCase().trim()),
      );

      selectedEmps.forEach((emp) => {
        [emp.id, emp.employeeId, emp.userId, emp.email, emp.name]
          .filter(Boolean)
          .forEach((val) =>
            allEmpIdentifiersSet.add(String(val).toLowerCase().trim()),
          );
        const mgrId = emp.managerId || emp.directManagerId;
        if (mgrId) {
          const mgrIdStr = String(mgrId).toLowerCase().trim();
          if (!managerIds.includes(mgrIdStr)) managerIds.push(mgrIdStr);
          allEmpIdentifiersSet.add(mgrIdStr);
          const mgrObj = employees.find(
            (e) =>
              String(e.id).toLowerCase().trim() === mgrIdStr ||
              String(e.employeeId || "")
                .toLowerCase()
                .trim() === mgrIdStr ||
              String(e.userId || "")
                .toLowerCase()
                .trim() === mgrIdStr ||
              String(e.email || "")
                .toLowerCase()
                .trim() === mgrIdStr ||
              String(e.name || "")
                .toLowerCase()
                .trim() === mgrIdStr,
          );
          if (mgrObj) {
            [
              mgrObj.id,
              mgrObj.employeeId,
              mgrObj.userId,
              mgrObj.email,
              mgrObj.name,
            ]
              .filter(Boolean)
              .forEach((val) =>
                allEmpIdentifiersSet.add(String(val).toLowerCase().trim()),
              );
            if (mgrObj.id && !managerIds.includes(String(mgrObj.id)))
              managerIds.push(String(mgrObj.id));
            if (
              mgrObj.employeeId &&
              !managerIds.includes(String(mgrObj.employeeId))
            )
              managerIds.push(String(mgrObj.employeeId));
          }
        }
      });
      const allEmpIdentifiers = Array.from(allEmpIdentifiersSet);

      const invPayload = {
        investigationNumber: invNum,
        title: invFormData.title,
        reason: invFormData.reason,
        investigationDate: invFormData.investigationDate,
        investigationTime: invFormData.investigationTime,
        location: invFormData.location,
        employeeId:
          selectedEmps[0]?.id ||
          selectedEmps[0]?.employeeId ||
          invFormData.selectedEmployeeIds[0] ||
          "",
        employeeIds: JSON.stringify(allEmpIdentifiers),
        employeeName: empNames,
        managerIds: JSON.stringify(managerIds),
        investigatorName: invFormData.investigatorName,
        status: "Scheduled",
        createdBy: currentUser?.name || "الشؤون القانونية",
        createdAt: new Date().toISOString(),
      };

      const res = await fetch("/api/investigations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(invPayload),
      });

      if (res.ok) {
        const createdInvData = await res.json();
        // Post Administrative Notice of type "investigation" (تحقيق إداري)
        const targetAll = Array.from(new Set(allEmpIdentifiers));
        const noticeTitle = `استدعاء جلسة تحقيق إداري - ${invFormData.title}`;
        const noticeContent = `<div style="direction: rtl; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; border-radius: 12px; background-color: #ffffff; border: 2px solid #ef4444; color: #111827; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h3 style="color: #dc2626; margin-top: 0; margin-bottom: 12px; font-weight: 900; font-size: 16px; border-bottom: 2px solid #fee2e2; padding-bottom: 8px;">📋 استدعاء جلسة تحقيق إداري رسمية</h3>
          <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">الموظف المدعو لحضور التحقيق:</strong> <span style="color: #dc2626; font-weight: 800;">${empNames}</span></p>
          <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">موضوع التحقيق:</strong> <span style="color: #1f2937; font-weight: 700;">${invFormData.title}</span></p>
          <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">سبب التحقيق والتفاصيل:</strong> <span style="color: #374151;">${invFormData.reason || "مراجعة الملاحظات الإدارية والقانونية"}</span></p>
          <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">موعد الجلسة:</strong> <span style="color: #111827; font-weight: 700;">${invFormData.investigationDate} في تمام الساعة ${invFormData.investigationTime}</span></p>
          <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">مكان / مقر التحقيق:</strong> <span style="color: #374151;">${invFormData.location || "الشؤون القانونية"}</span></p>
          <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">المحقق / المستشار المسؤول:</strong> <span style="color: #374151;">${invFormData.investigatorName || "المستشار القانوني"}</span></p>
          <hr style="margin: 12px 0; border: none; border-top: 1px dashed #fca5a5;"/>
          <p style="color: #991b1b; font-size: 12px; font-weight: 800; margin: 0; background-color: #fef2f2; padding: 10px; border-radius: 8px; border: 1px solid #fecaca; text-align: center;">⚠️ تنبيه هـام: يرجى من الموظف المدعو الالتزام بالحضور والتواجد في المكان والزمان المحددين أعلاه.</p>
        </div>`;

        await fetch("/api/administrative-notices", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify({
            investigationId: createdInvData?.id || "",
            title: noticeTitle,
            content: noticeContent,
            category: "investigation",
            priority: "urgent",
            noticeDate: invFormData.investigationDate,
            startDate: new Date().toISOString().split("T")[0],
            durationDays: 14,
            targetAudience: targetAll,
            createdByName: currentUser?.name || "الشؤون القانونية",
            createdByRole: "الشؤون القانونية والتحقيقات",
            createdById: profile?.id || user?.uid || "",
            status: "Published",
          }),
        });

        await refreshData();
        setIsInvModalOpen(false);
        setInvFormData({
          title: "",
          reason: "",
          investigationDate: new Date().toISOString().split("T")[0],
          investigationTime: "10:00",
          location: "مكتب الشؤون القانونية",
          investigatorName: currentUser?.name || "المستشار القانوني",
          selectedEmployeeIds: [],
        });
        alert(
          "تم إنشاء وجدولة جلسة التحقيق الإداري وإرسال التنبيهات الإدارية بنجاح!",
        );
      } else {
        alert("حدث خطأ أثناء إضافة جلسة التحقيق");
      }
    } catch (err: any) {
      alert("خطأ: " + err.message);
    }
  };

  const applyPenaltyToPayroll = async (penalty: any) => {
    let deductionAmount = 0;
    const employee = employees.find((e) => e.id === penalty.employeeId);

    if (
      employee &&
      ["Amount Deduction", "Day Deduction"].includes(penalty.penaltyType)
    ) {
      if (penalty.penaltyType === "Amount Deduction") {
        deductionAmount = Number(penalty.deductionValue) || 0;
      } else if (penalty.penaltyType === "Day Deduction") {
        const basic = Number(employee.basicSalary) || 0;
        deductionAmount = Number(
          ((basic / 30) * (Number(penalty.deductionValue) || 0)).toFixed(2),
        );
      }
    }

    if (deductionAmount > 0 && employee && penalty.targetMonth) {
      const token = localStorage.getItem("auth_token");
      const monthTransactions = transactions.filter(
        (tr) =>
          tr.employeeId === employee.id && tr.month === penalty.targetMonth,
      );

      let targetTransaction: any = null;
      if (monthTransactions.length > 0) {
        targetTransaction = { ...monthTransactions[0] };
        const oldOther = Number(targetTransaction.otherDeductions) || 0;
        targetTransaction.otherDeductions = Number(
          (oldOther + deductionAmount).toFixed(2),
        );
        targetTransaction.notes =
          `${targetTransaction.notes || ""} [جزاء مالي رقم ${penalty.penaltyNumber}]`.trim();

        const details = calculatePayrollDetails({
          ...targetTransaction,
          overtimeBaseSalary: employee.basicSalary,
        });
        targetTransaction.totalIncome = details.totalIncome;
        targetTransaction.totalDeductions = details.totalDeductions;
        targetTransaction.netSalary = details.netSalary;
      } else {
        let allowancesArr: any[] = [];
        if (employee.allowances) {
          try {
            allowancesArr =
              typeof employee.allowances === "string"
                ? JSON.parse(employee.allowances)
                : employee.allowances;
          } catch (err) {
            allowancesArr = [];
          }
        }
        if (!Array.isArray(allowancesArr)) allowancesArr = [];

        const basicSal = Number(employee.basicSalary) || 0;
        const housingAll = Number(employee.housingAllowance) || 0;
        const transportAll = Number(employee.transportAllowance) || 0;
        const subsistenceAll = Number(employee.subsistenceAllowance) || 0;
        const otherAll = (allowancesArr || []).reduce(
          (s: number, a: any) => s + (Number(a.amount) || 0),
          0,
        );
        const mobileAll = Number(employee.mobileAllowance) || 0;
        const managementAll = Number(employee.managementAllowance) || 0;

        const newTrId = doc(collection(null as any, "transactions")).id;
        const partialTransaction = {
          employeeId: employee.id,
          month: penalty.targetMonth,
          fiscalYear: new Date(penalty.penaltyDate).getFullYear().toString(),
          basicSalary: basicSal,
          housingAllowance: housingAll,
          transportAllowance: transportAll,
          subsistenceAllowance: subsistenceAll,
          otherAllowances: otherAll,
          mobileAllowance: mobileAll,
          managementAllowance: managementAll,
          overtimeHours: 0,
          overtimeAmount: 0,
          bonuses: 0,
          otherIncentives: 0,
          absenceDays: 0,
          absenceDeduction: 0,
          delayHours: 0,
          delayDeduction: 0,
          otherDeductions: deductionAmount,
          loansDeduction: 0,
          socialInsuranceDeduction:
            Number((employee as any).socialInsuranceDeduction) || 0,
          medicalInsuranceDeduction:
            Number((employee as any).medicalInsuranceDeduction) || 0,
          taxDeduction: Number((employee as any).taxDeduction) || 0,
          totalIncome: 0,
          totalDeductions: 0,
          netSalary: 0,
          paymentStatus: "Pending",
          notes: `[خصم جزاء مالي رقم ${penalty.penaltyNumber}]`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const details = calculatePayrollDetails({
          ...partialTransaction,
          overtimeBaseSalary: basicSal,
        });

        targetTransaction = {
          id: newTrId,
          ...partialTransaction,
          totalIncome: details.totalIncome,
          totalDeductions: details.totalDeductions,
          netSalary: details.netSalary,
        };
      }

      await fetch(`/api/transactions/${targetTransaction.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(targetTransaction),
      });
    }
  };

  // Dynamic filter lists
  const filteredPenalties = useMemo(() => {
    return penalties.filter((pen) => {
      const employee = employees.find((emp) => emp.id === pen.employeeId);
      const isSearchMatch =
        !searchQuery ||
        (employee?.name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (pen.penaltyNumber || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (pen.description || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const isEmployeeMatch =
        !filterEmployeeId || pen.employeeId === filterEmployeeId;
      const isTypeMatch =
        !filterViolationType || pen.violationType === filterViolationType;
      const isStatusMatch = !filterStatus || pen.status === filterStatus;

      return isSearchMatch && isEmployeeMatch && isTypeMatch && isStatusMatch;
    });
  }, [
    penalties,
    employees,
    searchQuery,
    filterEmployeeId,
    filterViolationType,
    filterStatus,
  ]);

  // Analytics KPIs calculations
  const analytics = useMemo(() => {
    const totalCount = penalties.length;
    const pendingCount = penalties.filter((p) => p.status === "Draft").length;
    const approvedCount = penalties.filter(
      (p) => p.status === "Approved",
    ).length;
    const totalFinancialDeducted = penalties.reduce((sum, p) => {
      if (p.status !== "Approved") return sum;
      if (["Amount Deduction", "Day Deduction"].includes(p.penaltyType)) {
        if (p.penaltyType === "Amount Deduction") {
          return sum + (Number(p.deductionValue) || 0);
        } else {
          // Day deduction
          const emp = employees.find((e) => e.id === p.employeeId);
          const basic = emp ? Number(emp.basicSalary) || 0 : 0;
          return sum + (basic / 30) * (Number(p.deductionValue) || 0);
        }
      }
      return sum;
    }, 0);

    return {
      totalCount,
      pendingCount,
      approvedCount,
      totalFinancialDeducted,
    };
  }, [penalties, employees]);

  // Reports calculations
  const reportData = useMemo(() => {
    let baseList = penalties;

    if (reportType === "financial") {
      baseList = penalties.filter((p) =>
        ["Amount Deduction", "Day Deduction"].includes(p.penaltyType),
      );
    } else if (reportType === "payroll") {
      baseList = penalties.filter(
        (p) =>
          p.status === "Approved" &&
          ["Amount Deduction", "Day Deduction"].includes(p.penaltyType),
      );
    } else if (reportType === "timeframe") {
      baseList = penalties.filter(
        (p) =>
          p.penaltyDate >= reportStartDate && p.penaltyDate <= reportEndDate,
      );
    }

    return baseList.map((pen) => {
      const emp = employees.find((e) => e.id === pen.employeeId);
      const dept = adminDepartments.find((d) => d.id === pen.departmentId);

      let calculatedDeduction = 0;
      if (
        emp &&
        ["Amount Deduction", "Day Deduction"].includes(pen.penaltyType)
      ) {
        if (pen.penaltyType === "Amount Deduction") {
          calculatedDeduction = Number(pen.deductionValue) || 0;
        } else {
          calculatedDeduction = Number(
            (
              (emp.basicSalary / 30) *
              (Number(pen.deductionValue) || 0)
            ).toFixed(2),
          );
        }
      }

      return {
        ...pen,
        employeeName: emp?.name || "—",
        departmentName: dept?.name || "—",
        calculatedDeduction,
        basicSalary: emp?.basicSalary || 0,
      };
    });
  }, [
    penalties,
    employees,
    adminDepartments,
    reportType,
    reportStartDate,
    reportEndDate,
  ]);

  // Translate labels
  const getViolationTypeName = (type: string) => {
    const map: Record<string, string> = {
      Delay: t("تأخير حضور"),
      Absence: t("غياب بدون عذر"),
      "Early Departure": t("انصراف مبكر"),
      "Instruction Violation": t("مخالفة التعليمات"),
      Misconduct: t("سلوك غير لائق"),
      Other: t("أخرى"),
    };
    return map[type] || type;
  };

  const getPenaltyTypeName = (type: string) => {
    const map: Record<string, string> = {
      Warning: t("إنذار كتابي"),
      "Final Warning": t("إنذار كتابي نهائي"),
      "Amount Deduction": t("خصم مبلغ مالي"),
      "Day Deduction": t("خصم أيام عمل"),
    };
    return map[type] || type;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "Pending Higher Manager":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "Pending Direct Manager":
      case "Pending Approval":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "Cancelled":
        return "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30";
      case "Rejected":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      case "Returned":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    }
  };

  const getStatusName = (status: string) => {
    switch (status) {
      case "Approved":
        return t("معتمد نهائياً");
      case "Pending Direct Manager":
        return t("بانتظار موافقة المدير المباشر");
      case "Pending Higher Manager":
        return t("بانتظار موافقة الرئيس الأعلى");
      case "Pending Approval":
        return t("بانتظار اعتماد المدير المباشر");
      case "Cancelled":
        return t("تم إلغاء الجزاء");
      case "Rejected":
        return t("مرفوض");
      case "Returned":
        return t("معاد للتعديل");
      default:
        return t("مسودة / تحت المراجعة");
    }
  };

  const pendingGrievances = useMemo(() => {
    return (penalties || []).filter(
      (p) =>
        (p.hasGrievance === true || (p as any).hasGrievance === 1) &&
        (p.grievanceStatus === "Pending" || (!p.grievanceStatus && p.grievanceReason)),
    );
  }, [penalties]);

  return (
    <div id="penalties-section" className="space-y-8 pb-12">
      {/* Pending Grievances Alert for HR */}
      {pendingGrievances.length > 0 && (
        <div className="bg-indigo-500/10 border-2 border-indigo-500/40 p-4 rounded-none flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-none flex items-center justify-center text-white shrink-0 shadow">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-200">
                📩 توجد ({pendingGrievances.length}) تظلمات إدارية مقدمة من الموظفين بانتظار قرار إدارة الموارد البشرية
              </h4>
              <p className="text-xs font-bold text-indigo-700/80 dark:text-indigo-300/80 mt-0.5">
                يرجى فحص مبررات التظلم المقدمة والبت فيها (قبول التظلم وتعديل الجزاء أو رفض التظلم).
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab("list");
              if (pendingGrievances[0]) {
                handleOpenGrievanceReview(pendingGrievances[0]);
              }
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-none transition-all flex items-center justify-center gap-2 shadow shrink-0 cursor-pointer"
          >
            <Scale className="w-4 h-4" />
            <span>مراجعة التظلمات الآن ({pendingGrievances.length})</span>
          </button>
        </div>
      )}

      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-card p-8 rounded-none border-2 border-primary shadow-[8px_8px_0px_0px_rgba(37,99,235,0.1)]">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-red-600 rounded-none flex items-center justify-center shadow-lg shadow-red-600/20">
            <AlertTriangle className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-black heading-gradient uppercase tracking-widest leading-none">
              {t("إدارة المخالفات والجزاءات الإدارية")}
            </h1>
            <div className="h-0.5 w-24 bg-red-600 mt-2" />
            <p className="text-muted-foreground font-bold mt-2 uppercase text-xs tracking-tighter">
              {t("ضبط السلوك الإداري وتقييم انضباط الموظفين")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("list")}
            className={cn(
              "px-5 py-3 font-bold border-2 transition-all rounded-none text-sm cursor-pointer",
              activeTab === "list"
                ? "bg-red-600 text-white border-red-600"
                : "bg-card text-foreground hover:bg-muted border-border",
            )}
          >
            {t("سجل الجزاءات")}
          </button>
          <button
            onClick={() => setActiveTab("investigations")}
            className={cn(
              "px-5 py-3 font-bold border-2 transition-all rounded-none text-sm cursor-pointer flex items-center gap-2",
              activeTab === "investigations"
                ? "bg-red-600 text-white border-red-600"
                : "bg-card text-foreground hover:bg-muted border-border",
            )}
          >
            <ShieldCheck className="w-4 h-4" />
            {t("التحقيقات الإدارية")}
          </button>
          <button
            onClick={() => setActiveTab("create")}
            className={cn(
              "px-5 py-3 font-bold border-2 transition-all rounded-none text-sm flex items-center gap-2 cursor-pointer",
              activeTab === "create"
                ? "bg-red-600 text-white border-red-600"
                : "bg-card text-foreground hover:bg-muted border-border",
            )}
          >
            <Plus className="w-4 h-4" />
            {t("تسجيل مخالفة")}
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={cn(
              "px-5 py-3 font-bold border-2 transition-all rounded-none text-sm cursor-pointer",
              activeTab === "reports"
                ? "bg-red-600 text-white border-red-600"
                : "bg-card text-foreground hover:bg-muted border-border",
            )}
          >
            {t("التقارير والإحصائيات")}
          </button>
        </div>
      </div>

      {/* Overview Analytics Dashboard */}
      {activeTab !== "create" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-card p-6 border-2 border-border/80 rounded-none relative">
            <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-widest">
              {t("إجمالي المخالفات")}
            </p>
            <h3 className="text-3xl font-black text-foreground">
              {analytics.totalCount} مخالفة
            </h3>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-red-500" />
          </div>
          <div className="bg-card p-6 border-2 border-border/80 rounded-none relative">
            <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-widest">
              {t("تحت المراجعة والاعتماد")}
            </p>
            <h3 className="text-3xl font-black text-amber-500">
              {analytics.pendingCount} مراجع
            </h3>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-amber-500" />
          </div>
          <div className="bg-card p-6 border-2 border-border/80 rounded-none relative">
            <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-widest">
              {t("مخالفات معتمدة")}
            </p>
            <h3 className="text-3xl font-black text-emerald-500">
              {analytics.approvedCount} معتمد
            </h3>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500" />
          </div>
          <div className="bg-card p-6 border-2 border-border/80 rounded-none relative">
            <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-widest">
              {t("إجمالي الخصومات المالية")}
            </p>
            <h3 className="text-3xl font-black text-red-600">
              {formatCurrency(analytics.totalFinancialDeducted)}
            </h3>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-red-600" />
          </div>
        </div>
      )}

      {/* INVESTIGATIONS TAB */}
      {activeTab === "investigations" && (
        <div className="space-y-6">
          <div className="bg-card p-6 border-2 border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-foreground">
                جلسات التحقيق الإداري والتنبيهات الموجهة
              </h2>
              <p className="text-xs text-muted-foreground font-medium mt-1">
                سجل جلسات التحقيق المجدولة والمكتملة وإرسال إدارة التنبيهات
                الإدارية للموظفين ومديريهم المباشرين
              </p>
            </div>
            <div className="flex items-center gap-2">
              {invSubTab === "sessions" ? (
                <button
                  onClick={() => setIsInvModalOpen(true)}
                  className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-none shadow-md flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء تحقيق إداري جديد</span>
                </button>
              ) : (
                <button
                  onClick={() =>
                    setCreateNoticeModal((prev) => ({ ...prev, isOpen: true }))
                  }
                  className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-none shadow-md flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء تنبيه إداري موجه</span>
                </button>
              )}
            </div>
          </div>

          {/* Sub-tabs toggle */}
          <div className="flex items-center gap-2 border-b-2 border-border pb-1">
            <button
              onClick={() => setInvSubTab("sessions")}
              className={`px-4 py-2 text-xs font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                invSubTab === "sessions"
                  ? "border-red-600 text-red-600 bg-red-500/10"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>جلسات التحقيق الإداري</span>
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                {(investigations || []).length}
              </span>
            </button>
            <button
              onClick={() => setInvSubTab("notices")}
              className={`px-4 py-2 text-xs font-black flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                invSubTab === "notices"
                  ? "border-red-600 text-red-600 bg-red-500/10"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Megaphone className="w-4 h-4" />
              <span>التنبيهات الإدارية الموجهة</span>
              <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                {(administrativeNotices || []).length}
              </span>
            </button>
          </div>

          <div className="bg-card border-2 border-border rounded-none overflow-hidden shadow-sm">
            {invSubTab === "sessions" ? (
              (investigations || []).length === 0 ? (
                <div className="p-12 text-center space-y-4">
                  <div className="w-16 h-16 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-8 h-8" />
                  </div>
                  <h3 className="font-black text-base text-foreground">
                    لا توجد جلسات تحقيق إداري حالياً
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    يمكنك استخدام زر "إنشاء تحقيق إداري جديد" لجدولة جلسة تحقيق
                    وإرسال تنبيه إداري للموظفين المعنيين ومديرهم المباشر.
                  </p>
                  <button
                    onClick={() => setIsInvModalOpen(true)}
                    className="px-4 py-2 bg-red-600 text-white font-black text-xs rounded-none hover:bg-red-700 cursor-pointer"
                  >
                    + إنشاء أول جلسة تحقيق
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-muted text-muted-foreground font-black border-b border-border">
                      <tr>
                        <th className="p-4">رقم التحقيق</th>
                        <th className="p-4">عنوان وموضوع التحقيق</th>
                        <th className="p-4">الموظفون المعنيون</th>
                        <th className="p-4">موعد الجلسة</th>
                        <th className="p-4">مكان التحقيق</th>
                        <th className="p-4">المحقق المسؤول</th>
                        <th className="p-4 text-center">الإجراءات والنتيجة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-bold">
                      {(investigations || []).map((inv: any) => {
                        let empArr: string[] = [];
                        try {
                          empArr =
                            typeof inv.employeeIds === "string"
                              ? JSON.parse(inv.employeeIds)
                              : inv.employeeIds || [];
                        } catch (e) {}

                        const empNames = empArr
                          .map((eId) => {
                            const emp = employees.find(
                              (e) => e.id === eId || e.employeeId === eId,
                            );
                            return emp?.name || eId;
                          })
                          .join("، ");

                        return (
                          <tr
                            key={inv.id}
                            className="hover:bg-muted/30 transition-colors"
                          >
                            <td className="p-4 font-black text-red-600 dir-ltr text-right">
                              {inv.investigationNumber || inv.id}
                            </td>
                            <td className="p-4">
                              <span className="font-black text-foreground block">
                                {inv.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-normal line-clamp-1">
                                {inv.reason}
                              </span>
                              {inv.recommendation && (
                                <span className="text-[10px] text-red-600 font-bold block mt-1 bg-red-500/10 p-1 rounded border border-red-500/20">
                                  ⚖️ {inv.recommendation}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-muted-foreground max-w-xs">
                              {empNames || inv.employeeName || "—"}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1.5 text-foreground">
                                <Calendar className="w-3.5 h-3.5 text-red-600" />
                                <span>{inv.investigationDate}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mt-0.5">
                                <Clock className="w-3 h-3" />
                                <span>{inv.investigationTime}</span>
                              </div>
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {inv.location || "الشؤون القانونية"}
                            </td>
                            <td className="p-4 text-foreground">
                              {inv.investigatorName || "المستشار القانوني"}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex flex-col items-center gap-1.5">
                                <span
                                  className={`px-2.5 py-1 text-[10px] font-black rounded-full border ${
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
                                {isHRRole && (
                                  <div className="flex items-center gap-1 flex-wrap justify-center mt-1">
                                    <button
                                      onClick={() => handleOpenResultModal(inv)}
                                      className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] rounded transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                      title="إضافة أو تعديل نتيجة التحقيق والقرار الإداري"
                                    >
                                      <FileCheck className="w-3 h-3" />
                                      <span>
                                        {inv.recommendation
                                          ? "النتيجة"
                                          : "إضافة النتيجة"}
                                      </span>
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditInv(inv)}
                                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] rounded transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                      title="تعديل جلسة التحقيق"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>تعديل</span>
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleDeleteInvestigation(inv.id)
                                      }
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                      title="مسح جلسة التحقيق والتنبيه الموجه"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>مسح</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : /* ADMINISTRATIVE NOTICES TABLE */
            (administrativeNotices || []).length === 0 ? (
              <div className="p-12 text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <Megaphone className="w-8 h-8" />
                </div>
                <h3 className="font-black text-base text-foreground">
                  لا توجد تنبيهات إدارية موجهة حالياً
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  يمكنك إنشاء وتوجيه تنبيهات إدارية رسمية لموظفين محددين أو
                  للإدارة بالكامل.
                </p>
                <button
                  onClick={() =>
                    setCreateNoticeModal((prev) => ({ ...prev, isOpen: true }))
                  }
                  className="px-4 py-2 bg-red-600 text-white font-black text-xs rounded-none hover:bg-red-700 cursor-pointer"
                >
                  + إنشاء أول تنبيه إداري
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted text-muted-foreground font-black border-b border-border">
                    <tr>
                      <th className="p-4">العنوان والتفاصيل</th>
                      <th className="p-4">الفئة والأولوية</th>
                      <th className="p-4">تاريخ النشر</th>
                      <th className="p-4">الفئة المستهدفة</th>
                      <th className="p-4">الناشر</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-bold">
                    {(administrativeNotices || []).map((notice: any) => {
                      const targetAud = Array.isArray(notice.targetAudience)
                        ? notice.targetAudience
                        : [];
                      const targetText =
                        targetAud.includes("all") || targetAud.length === 0
                          ? "جميع الموظفين"
                          : `موجه لـ ${targetAud.length} معرف/موظف`;

                      return (
                        <tr
                          key={notice.id}
                          className="hover:bg-muted/30 transition-colors"
                        >
                          <td className="p-4 max-w-sm">
                            <span className="font-black text-foreground block">
                              {notice.title}
                            </span>
                            <div
                              className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5"
                              dangerouslySetInnerHTML={{
                                __html: sanitizeHtml(notice.content),
                              }}
                            />
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 text-[10px] font-bold w-fit">
                                {notice.category === "investigation"
                                  ? "جلسة تحقيق"
                                  : notice.category || "تنبيه إداري"}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                                  notice.priority === "urgent"
                                    ? "bg-red-500/10 text-red-600"
                                    : "bg-slate-500/10 text-slate-600"
                                }`}
                              >
                                {notice.priority === "urgent"
                                  ? "عاجل ورسمي"
                                  : "عادي"}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {notice.noticeDate ||
                              notice.createdAt?.split("T")[0] ||
                              "—"}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {targetText}
                          </td>
                          <td className="p-4 text-foreground">
                            {notice.createdByName ||
                              notice.createdBy ||
                              "الشؤون القانونية"}
                          </td>
                          <td className="p-4 text-center">
                            {isHRRole && (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setViewNoticeModal({ isOpen: true, notice })}
                                  className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white font-black text-[10px] rounded transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                  title="عرض تفاصيل التنبيه الإداري"
                                >
                                  <Eye className="w-3 h-3" />
                                  <span>عرض</span>
                                </button>
                                <button
                                  onClick={() => handleOpenEditNotice(notice)}
                                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-black text-[10px] rounded transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                  title="تعديل التنبيه الإداري"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>تعديل</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteNotice(notice.id)}
                                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                                  title="مسح / حذف التنبيه الإداري"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>مسح</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LIST TAB */}
      {activeTab === "list" && (
        <div className="space-y-6">
          {/* Filters shelf */}
          <div className="bg-card p-6 border border-border flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2" />
                <input
                  placeholder={t("بحث باسم الموظف أو رقم الجزاء...")}
                  className="w-full pl-4 pr-10 py-2.5 bg-muted/30 border border-border rounded-none text-sm outline-none focus:ring-1 focus:ring-red-600 text-foreground"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <select
                className="px-4 py-2.5 bg-muted/30 border border-border text-sm rounded-none outline-none text-foreground focus:ring-1 focus:ring-red-600"
                value={filterEmployeeId}
                onChange={(e) => setFilterEmployeeId(e.target.value)}
              >
                <option value="">{t("كل الموظفين")}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>

              <select
                className="px-4 py-2.5 bg-muted/30 border border-border text-sm rounded-none outline-none text-foreground focus:ring-1 focus:ring-red-600"
                value={filterViolationType}
                onChange={(e) => setFilterViolationType(e.target.value)}
              >
                <option value="">{t("كل أنواع المخالفات")}</option>
                <option value="Delay">{t("تأخير")}</option>
                <option value="Absence">{t("غياب")}</option>
                <option value="Early Departure">{t("انصراف مبكر")}</option>
                <option value="Instruction Violation">
                  {t("مخالفة التعليمات")}
                </option>
                <option value="Misconduct">{t("سلوك غير لائق")}</option>
                <option value="Other">{t("أخرى")}</option>
              </select>

              <select
                className="px-4 py-2.5 bg-muted/30 border border-border text-sm rounded-none outline-none text-foreground focus:ring-1 focus:ring-red-600"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">{t("كل الحالات")}</option>
                <option value="Approved">{t("معتمد نهائياً")}</option>
                <option value="Cancelled">{t("تم إلغاء الجزاء")}</option>
                <option value="Pending Direct Manager">{t("بانتظار موافقة المدير المباشر")}</option>
                <option value="Pending Higher Manager">{t("بانتظار موافقة الرئيس الأعلى")}</option>
                <option value="Returned">{t("معاد للتعديل")}</option>
                <option value="Rejected">{t("مرفوض")}</option>
                <option value="Draft">{t("مسودة")}</option>
              </select>
            </div>
          </div>

          {/* Grid table */}
          <div className="bg-card border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-right text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-6 py-4 text-semibold text-muted-foreground">
                      {t("رقم الجزاء")}
                    </th>
                    <th className="px-6 py-4 text-semibold text-muted-foreground">
                      {t("اسم الموظف")}
                    </th>
                    <th className="px-6 py-4 text-semibold text-muted-foreground">
                      {t("نوع المخالفة")}
                    </th>
                    <th className="px-6 py-4 text-semibold text-muted-foreground">
                      {t("نوع العقوبة")}
                    </th>
                    <th className="px-6 py-4 text-semibold text-muted-foreground">
                      {t("قيمة الخصم")}
                    </th>
                    <th className="px-6 py-4 text-semibold text-muted-foreground">
                      {t("تاريخ المخالفة")}
                    </th>
                    <th className="px-6 py-4 text-semibold text-muted-foreground">
                      {t("الحالة")}
                    </th>
                    <th className="px-6 py-4 text-bold text-slate-800 dark:text-slate-100 text-left">
                      {t("التحكم")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPenalties.length > 0 ? (
                    filteredPenalties.map((pen) => {
                      const employee = employees.find(
                        (e) => e.id === pen.employeeId,
                      );

                      // Calculate Egyptian Pound representation
                      let valString = "—";
                      if (
                        ["Amount Deduction", "Day Deduction"].includes(
                          pen.penaltyType,
                        )
                      ) {
                        if (pen.penaltyType === "Amount Deduction") {
                          valString = formatCurrency(
                            Number(pen.deductionValue) || 0,
                          );
                        } else if (
                          pen.penaltyType === "Day Deduction" &&
                          employee
                        ) {
                          const basic = Number(employee.basicSalary) || 0;
                          const calculatedVal = Number(
                            (
                              (basic / 30) *
                              (Number(pen.deductionValue) || 0)
                            ).toFixed(2),
                          );
                          valString = `${pen.deductionValue} أيام (خصم ${formatCurrency(calculatedVal)})`;
                        }
                      }

                      return (
                        <tr
                          key={pen.id}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-6 py-4 font-black">
                            {pen.penaltyNumber}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-foreground block">
                              {employee?.name || "—"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {employee?.jobTitle || "—"}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold">
                            {getViolationTypeName(pen.violationType)}
                          </td>
                          <td className="px-6 py-4 text-red-600 dark:text-red-400 font-bold">
                            {getPenaltyTypeName(pen.penaltyType)}
                          </td>
                          <td className="px-6 py-4 tabular-nums font-black">
                            {valString}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-muted-foreground">
                            {pen.violationDate}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={cn(
                                "px-3 py-1 text-xs font-bold border",
                                getStatusBadgeClass(pen.status),
                              )}
                            >
                              {getStatusName(pen.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-left">
                            <div className="flex items-center gap-1.5 justify-end flex-wrap">
                              <button
                                onClick={() => handleStartEdit(pen)}
                                className="px-2.5 py-1 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-none cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
                                title="تعديل الجزاء"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{t("تعديل")}</span>
                              </button>

                              <button
                                onClick={() => handleDeletePenalty(pen)}
                                className="px-2.5 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-none cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
                                title="حذف الجزاء"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{t("حذف")}</span>
                              </button>

                              {pen.status !== "Cancelled" && (
                                <button
                                  onClick={() => handleCancelOrSuspendPenalty(pen)}
                                  className="px-2.5 py-1 text-xs font-bold bg-slate-700 hover:bg-slate-800 text-white rounded-none cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
                                  title="إلغاء / إيقاف الجزاء"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>{t("إلغاء/إيقاف")}</span>
                                </button>
                              )}

                              <button
                                onClick={() => setViewingPenalty(pen)}
                                className="px-2.5 py-1 text-xs font-bold bg-muted/60 hover:bg-muted text-foreground border border-border cursor-pointer flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{t("التفاصيل والمراجعة")}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-16 text-muted-foreground"
                      >
                        {t("لا توجد جزاءات مسجلة تطابق محركات البحث والفلترة.")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE TAB */}
      {activeTab === "create" && (
        <div className="bg-card border border-border p-10">
          <div className="border-b border-border pb-4 mb-8">
            <h2 className="text-xl font-black text-foreground">
              {t("نموذج تسجيل مخالفة إدارية إلكترونية جديدة")}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {t("تأكد من إرفاق تفاصيل دقيقة لتفادي المراجعات الإدارية")}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground mr-2">
                  {t("نوع مسار اعتماد الجزاء *")}
                </label>
                <select
                  required
                  className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                  value={formData.disciplinaryApprovalType}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      disciplinaryApprovalType: e.target.value,
                    })
                  }
                >
                  <option value="Approved by Direct Manager">
                    {t("اعتماد المدير المباشر + الرئيس الأعلى")}
                  </option>
                  <option value="Issued by Top Management">
                    {t("صادر مباشرة من الإدارة العليا (اعتماد فوري)")}
                  </option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground mr-2">
                  {t("الرقم المرجعي / الإشارة")}
                </label>
                <input
                  placeholder={t(
                    "توليد تلقائي إن ترك فارغاً (مثال: REF-2026-0001)",
                  )}
                  className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                  value={formData.referenceNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      referenceNumber: e.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground mr-2">
                  {t("الموظف المعني بالمخالفة *")}
                </label>
                <select
                  required
                  className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                  value={formData.employeeId}
                  onChange={(e) =>
                    setFormData({ ...formData, employeeId: e.target.value })
                  }
                >
                  <option value="">{t("اختر الموظف...")}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.jobTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground mr-2">
                  {t("نوع المخالفة *")}
                </label>
                <select
                  required
                  className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                  value={formData.violationType}
                  onChange={(e) =>
                    setFormData({ ...formData, violationType: e.target.value })
                  }
                >
                  <option value="Delay">{t("مخالفة تأخير الحضور")}</option>
                  <option value="Absence">{t("غياب بدون إذن")}</option>
                  <option value="Early Departure">
                    {t("مخالفة انصراف مبكر")}
                  </option>
                  <option value="Instruction Violation">
                    {t("مخالفة التعليمات والتوجيهات")}
                  </option>
                  <option value="Misconduct">{t("سلوك غير مهني")}</option>
                  <option value="Other">{t("أخرى / مخالفة عامة")}</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground mr-2">
                  {t("تاريخ وقوع المخالفة *")}
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                  value={formData.violationDate}
                  onChange={(e) =>
                    setFormData({ ...formData, violationDate: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground mr-2">
                  {t("تاريخ توقيع المخالفة والقرار *")}
                </label>
                <input
                  type="date"
                  required
                  className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                  value={formData.penaltyDate}
                  onChange={(e) =>
                    setFormData({ ...formData, penaltyDate: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground mr-2">
                  {t("نوع الجزاء والعقوبة المتخذة *")}
                </label>
                <select
                  required
                  className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                  value={formData.penaltyType}
                  onChange={(e) =>
                    setFormData({ ...formData, penaltyType: e.target.value })
                  }
                >
                  <option value="Warning">{t("إنذار كتابي")}</option>
                  <option value="Final Warning">
                    {t("إنذار كتابي نهائي")}
                  </option>
                  <option value="Amount Deduction">
                    {t("خصم مبلغ مالي مباشر")}
                  </option>
                  <option value="Day Deduction">
                    {t("خصم أيام من راتب الموظف")}
                  </option>
                </select>
              </div>

              {["Amount Deduction", "Day Deduction"].includes(
                formData.penaltyType,
              ) && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">
                      {formData.penaltyType === "Amount Deduction"
                        ? t("قيمة مبلغ الخصم (جنيه مصري) *")
                        : t("عدد الأيام المطلوب خصمها *")}
                    </label>
                    <input
                      type="number"
                      step={
                        formData.penaltyType === "Amount Deduction"
                          ? "0.01"
                          : "0.5"
                      }
                      required
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-semibold"
                      value={formData.deductionValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          deductionValue: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">
                      {t("الشهر المستهدف لتطبيق الخصم بالمرتبات *")}
                    </label>
                    <input
                      type="month"
                      required
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                      value={formData.targetMonth}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          targetMonth: e.target.value,
                        })
                      }
                    />
                  </div>
                </>
              )}

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-muted-foreground mr-2">
                  {t("توصيف المخالفة ووقائع السلوك *")}
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder={t("اكتب التوصيف الكامل للمخالفة بالتفصيل...")}
                  className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground mr-2">
                  {t("مستند الإثبات والتحقيق (رابط ملف المرفق إن وجد)")}
                </label>
                <input
                  placeholder="https://example.com/attachment.pdf"
                  className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                  value={formData.attachmentUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, attachmentUrl: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-muted-foreground mr-2">
                  {t("ملاحظات المدير العام / المراجع")}
                </label>
                <input
                  placeholder={t("يكتب فقط كملاحظات إشرافية...")}
                  className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                  value={formData.adminNotes}
                  onChange={(e) =>
                    setFormData({ ...formData, adminNotes: e.target.value })
                  }
                />
              </div>

              {/* إعدادات مهلة تقديم التظلم ومدة ظهور الجزاء للموظف */}
              <div className="md:col-span-2 p-4 bg-indigo-500/5 border border-indigo-500/20 space-y-4">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200">
                  <Scale className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h4 className="text-sm font-black">{t("إعدادات مهلة التظلم وظهور الجزاء للموظف")}</h4>
                    <p className="text-[11px] text-muted-foreground">
                      {t("تحديد عدد أيام مهلة تقديم التظلم الإداري ومدة استمرار إبراز الجزاء داخل لوحة الموظف")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>{t("مهلة تقديم التظلم (بالأيام) *")}</span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-black">
                        {formData.grievanceWindowDays || 7} {t("أيام")}
                      </span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      required
                      placeholder="7"
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-none focus:ring-2 focus:ring-indigo-600 outline-none text-foreground font-semibold text-sm"
                      value={formData.grievanceWindowDays}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          grievanceWindowDays: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                    <span className="text-[10px] text-muted-foreground block">
                      {t("عدد الأيام المسموح للموظف خلالها بتقديم تظلم من تاريخ اعتماد/إصدار الجزاء")}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center justify-between">
                      <span>{t("مدة ظهور الجزاء للموظف (بالأيام) *")}</span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono font-black">
                        {formData.visibilityDurationDays || 30} {t("يوماً")}
                      </span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      required
                      placeholder="30"
                      className="w-full px-4 py-2.5 bg-background border border-border rounded-none focus:ring-2 focus:ring-indigo-600 outline-none text-foreground font-semibold text-sm"
                      value={formData.visibilityDurationDays}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          visibilityDurationDays: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                    <span className="text-[10px] text-muted-foreground block">
                      {t("عدد الأيام التي يظل فيها الجزاء ظاهرًا داخل شاشة الموظف الرئيسية")}
                    </span>
                  </div>
                </div>

                {/* Live Preview of Calculated Dates */}
                <div className="p-3 bg-muted/40 border border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold">{t("تاريخ بداية التظلم:")}</span>
                    <span className="font-extrabold text-foreground font-mono">
                      {formData.penaltyDate || new Date().toISOString().split("T")[0]}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold">{t("آخر موعد لتقديم التظلم:")}</span>
                    <span className="font-black text-indigo-700 dark:text-indigo-300 font-mono">
                      {calculateFutureDate(formData.penaltyDate || new Date().toISOString().split("T")[0], Number(formData.grievanceWindowDays) || 7)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold">{t("حالة التظلم الافتراضية:")}</span>
                    <span className="font-black text-emerald-600">
                      {t("متاح")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] font-bold">{t("تاريخ انتهاء الظهور للموظف:")}</span>
                    <span className="font-black text-amber-700 dark:text-amber-300 font-mono">
                      {calculateFutureDate(formData.penaltyDate || new Date().toISOString().split("T")[0], Number(formData.visibilityDurationDays) || 30)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-heavy transition-colors rounded-none shadow-md flex items-center gap-2 text-sm uppercase cursor-pointer"
              >
                {isSubmitting
                  ? t("جاري الحفظ والإنشاء...")
                  : t("تسجيل المخالفة في النظام كمسودة")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("list")}
                className="px-8 py-4 bg-muted text-foreground hover:bg-muted/80 font-bold transition-colors rounded-none text-sm cursor-pointer"
              >
                {t("إلغاء التراجع")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === "reports" && (
        <div className="space-y-8">
          {/* Controls box */}
          <div className="bg-card p-8 border border-border flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-xl font-black text-foreground">
                {t("مركز استخلاص وإصدار تقارير العقوبات والجزاءات")}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t("تقارير رسمية متطابقة للطباعة والربط بمالية الإدارة")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <select
                className="px-4 py-2.5 bg-muted/40 border border-border text-sm rounded-none outline-none font-bold text-foreground focus:ring-1 focus:ring-red-600"
                value={reportType}
                onChange={(e) => setReportType(e.target.value as any)}
              >
                <option value="all">
                  {t("تقرير الجزاءات العام (كل المخالفات)")}
                </option>
                <option value="financial">
                  {t("تقرير الجزاءات المالية فقط")}
                </option>
                <option value="payroll">
                  {t("تقرير الخصومات المعتمدة من رواتب الموظفين")}
                </option>
                <option value="timeframe">
                  {t("تقرير الجزاءات خلال فترة زمنية محددة")}
                </option>
              </select>

              {reportType === "timeframe" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="px-3 py-2 bg-muted/40 border border-border text-xs font-semibold text-foreground rounded-none"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground font-bold">
                    {t("إلى")}
                  </span>
                  <input
                    type="date"
                    className="px-3 py-2 bg-muted/40 border border-border text-xs font-semibold text-foreground rounded-none"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                  />
                </div>
              )}

              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-800 text-white hover:bg-slate-900 border-none font-black text-xs flex items-center gap-2 rounded-none cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                {t("تصدير وطباعة PDF")}
              </button>
            </div>
          </div>

          {/* Report output grid */}
          <div className="bg-card border border-border p-8 print:p-0">
            <div className="text-center py-6 border-b border-dashed border-border mb-8 print:block hidden">
              <h1 className="text-2xl font-black">
                {t("شركة أوبركس للأنظمة والموارد البشرية")}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {t("تقرير العقوبات والجزاءات الإدارية المعتمدة والمسودة")}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-muted/70 border-b border-border">
                    <th className="px-5 py-3.5 font-black text-slate-800 dark:text-slate-200">
                      {t("الرقم المرجعي")}
                    </th>
                    <th className="px-5 py-3.5 font-black text-slate-800 dark:text-slate-200">
                      {t("اسم الموظف")}
                    </th>
                    <th className="px-5 py-3.5 font-black text-slate-800 dark:text-slate-200">
                      {t("القسم الإداري")}
                    </th>
                    <th className="px-5 py-3.5 font-black text-slate-800 dark:text-slate-200">
                      {t("الراتب الأساسي")}
                    </th>
                    <th className="px-5 py-3.5 font-black text-slate-800 dark:text-slate-200">
                      {t("تاريخ العقوبة")}
                    </th>
                    <th className="px-5 py-3.5 font-black text-slate-800 dark:text-slate-200">
                      {t("نوع وهيكل الجزاء")}
                    </th>
                    <th className="px-5 py-3.5 font-black text-slate-800 dark:text-slate-200">
                      {t("قيمة الخصم بالجنيه")}
                    </th>
                    <th className="px-5 py-3.5 font-black text-slate-800 dark:text-slate-200 text-left">
                      {t("الحالة")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reportData.length > 0 ? (
                    reportData.map((pen, i) => (
                      <tr key={pen.id || i} className="hover:bg-muted/10">
                        <td className="px-5 py-3 font-semibold">
                          {pen.penaltyNumber}
                        </td>
                        <td className="px-5 py-3 font-bold">
                          {pen.employeeName}
                        </td>
                        <td className="px-5 py-3 text-xs font-medium text-muted-foreground">
                          {pen.departmentName}
                        </td>
                        <td className="px-5 py-3 tabular-nums font-medium">
                          {formatCurrency(pen.basicSalary)}
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          {pen.penaltyDate}
                        </td>
                        <td className="px-5 py-3 font-bold text-red-600 dark:text-red-400">
                          {getPenaltyTypeName(pen.penaltyType)}
                        </td>
                        <td className="px-5 py-3 tabular-nums font-black text-red-600">
                          {pen.calculatedDeduction > 0
                            ? formatCurrency(pen.calculatedDeduction)
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-left">
                          <span
                            className={cn(
                              "px-2 py-0.5 text-xs font-bold border",
                              getStatusBadgeClass(pen.status),
                            )}
                          >
                            {getStatusName(pen.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-center py-16 text-muted-foreground"
                      >
                        {t(
                          "لا توجد بيانات مستخلصة تطابق نوع الفلترة والتقرير المختار.",
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground font-semibold mt-10 print:flex hidden">
              <span>{t("توقيع مسؤول إدارة الكفاءات البشرية")}</span>
              <span>{t("توقيع المدير المالي التنفيذي")}</span>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DETAILS MODAL */}
      {viewingPenalty && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-2xl border-2 border-primary rounded-none shadow-2xl overflow-hidden text-right leading-relaxed max-h-[90vh] overflow-y-auto">
            <div className="bg-red-600 text-white px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-black text-lg">
                  تفاصيل المخالفة والقرار التأديبي رقم{" "}
                  {viewingPenalty.penaltyNumber}
                </h3>
              </div>
              <button
                onClick={() => setViewingPenalty(null)}
                className="text-white hover:bg-white/10 p-1.5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* REASON BANNERS */}
              {viewingPenalty.returnReason &&
                (viewingPenalty.status === "Returned" ||
                  viewingPenalty.status === "Returned for Re-evaluation") && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-none text-right">
                    <span className="font-black text-xs text-amber-600 block">
                      {t("سبب وملاحظات إعادة الجزاء للمراجعة:")}
                    </span>
                    <p className="text-xs font-bold text-amber-800 dark:text-amber-200 mt-1">
                      {viewingPenalty.returnReason}
                    </p>
                  </div>
                )}

              {viewingPenalty.rejectionReason &&
                viewingPenalty.status === "Rejected" && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-none text-right">
                    <span className="font-black text-xs text-rose-600 block">
                      {t("سبب رفض قرار الجزاء:")}
                    </span>
                    <p className="text-xs font-bold text-rose-800 dark:text-rose-200 mt-1">
                      {viewingPenalty.rejectionReason}
                    </p>
                  </div>
                )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/30 p-4 border border-border">
                  <span className="text-xs font-bold text-muted-foreground block mb-1">
                    {t("الرقم المرجعي / الإشارة")}
                  </span>
                  <span className="font-black text-foreground">
                    {viewingPenalty.referenceNumber ||
                      viewingPenalty.reference_number ||
                      "—"}
                  </span>
                </div>

                <div className="bg-muted/30 p-4 border border-border">
                  <span className="text-xs font-bold text-muted-foreground block mb-1">
                    {t("نوع مسار الاعتماد")}
                  </span>
                  <span className="font-bold text-xs text-blue-600 dark:text-blue-400">
                    {(viewingPenalty.disciplinaryApprovalType ||
                      viewingPenalty.disciplinary_approval_type) ===
                    "Issued by Top Management"
                      ? t("صادر من الإدارة العليا مباشرة")
                      : t("اعتماد المدير المباشر + الرئيس الأعلى")}
                  </span>
                </div>

                <div className="bg-muted/30 p-4 border border-border">
                  <span className="text-xs font-bold text-muted-foreground block mb-1">
                    {t("اسم الموظف المعني")}
                  </span>
                  <span className="font-black text-foreground">
                    {employees.find((e) => e.id === viewingPenalty.employeeId)
                      ?.name || "—"}
                  </span>
                </div>

                <div className="bg-muted/30 p-4 border border-border">
                  <span className="text-xs font-bold text-muted-foreground block mb-1">
                    {t("نوع المخالفة والسلوك")}
                  </span>
                  <span className="font-black text-red-600 dark:text-red-400">
                    {getViolationTypeName(viewingPenalty.violationType)}
                  </span>
                </div>

                <div className="bg-muted/30 p-4 border border-border">
                  <span className="text-xs font-bold text-muted-foreground block mb-1">
                    {t("نوع العقوبة المقررة")}
                  </span>
                  <span className="font-black text-foreground">
                    {getPenaltyTypeName(viewingPenalty.penaltyType)}
                  </span>
                </div>

                <div className="bg-muted/30 p-4 border border-border">
                  <span className="text-xs font-bold text-muted-foreground block mb-1">
                    {t("تاريخ وقوع المخالفة")}
                  </span>
                  <span className="font-bold text-muted-foreground">
                    {viewingPenalty.violationDate}
                  </span>
                </div>
              </div>

              {["Amount Deduction", "Day Deduction"].includes(
                viewingPenalty.penaltyType,
              ) && (
                <div className="p-5 bg-red-500/5 border border-red-500/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-xs font-black text-red-600 block mb-1">
                        {t("قيمة الخصم المستقطع")}
                      </span>
                      <span className="text-xl font-black text-foreground">
                        {viewingPenalty.penaltyType === "Amount Deduction"
                          ? formatCurrency(
                              Number(viewingPenalty.deductionValue),
                            )
                          : `${viewingPenalty.deductionValue} أيام عمل`}
                      </span>
                    </div>
                    {viewingPenalty.targetMonth && (
                      <div className="text-left">
                        <span className="text-xs font-black text-muted-foreground block mb-1">
                          {t("الشهر المستهدف في الرواتب")}
                        </span>
                        <span className="text-lg font-black text-slate-800 dark:text-slate-100">
                          {viewingPenalty.targetMonth}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-muted/10 p-5 border border-border text-sm">
                <span className="text-xs font-black text-muted-foreground block mb-2">
                  {t("توصيف ملابسات المخالفة المتخذة")}
                </span>
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {viewingPenalty.description}
                </p>
              </div>

              {viewingPenalty.attachmentUrl && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-muted-foreground">
                    {t("ملف مستند الإثبات:")}
                  </span>
                  <a
                    href={viewingPenalty.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline hover:text-blue-700 font-bold"
                  >
                    {t("عرض الملف المرفق والتحقيق")}
                  </a>
                </div>
              )}

              {/* RECORDED OPINIONS BOX */}
              <div className="p-4 bg-muted/20 border border-border space-y-2 text-xs">
                <span className="font-black text-foreground block mb-2">
                  سجل قرارات وآراء مسار الاعتماد الإداري:
                </span>
                
                <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2">
                  <span className="font-bold text-muted-foreground">رأي المدير المباشر:</span>
                  <div className="text-left font-black">
                    {viewingPenalty.directManagerDecision === "Approved" ? (
                      <span className="text-emerald-600">✅ موافقة على الجزاء</span>
                    ) : viewingPenalty.directManagerDecision === "Objected" ? (
                      <span className="text-rose-600">❌ اعتراض: {viewingPenalty.directManagerObjectionReason || "دون ذكر تفاصيل"}</span>
                    ) : (
                      <span className="text-amber-600">بانتظار مراجعة المدير المباشر</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2">
                  <span className="font-bold text-muted-foreground">رأي الرئيس الأعلى:</span>
                  <div className="text-left font-black">
                    {(() => {
                      const mgrInfo = getPenaltyManagers(viewingPenalty, employees);
                      if (!mgrInfo.hasHigherManager) {
                        return <span className="text-muted-foreground font-medium">غير مطلوب (لا يوجد رئيس أعلى للمدير المباشر)</span>;
                      }
                      if (viewingPenalty.higherManagerDecision === "Approved") {
                        return <span className="text-emerald-600">✅ موافقة على الجزاء</span>;
                      }
                      if (viewingPenalty.higherManagerDecision === "Objected") {
                        return <span className="text-rose-600">❌ اعتراض / إبداء رأي: {viewingPenalty.higherManagerObjectionReason || "دون ذكر تفاصيل"}</span>;
                      }
                      return <span className="text-amber-600">بانتظار مراجعة الرئيس الأعلى</span>;
                    })()}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-3">
                  <span className="font-bold text-muted-foreground">قرار إدارة الموارد البشرية (HR):</span>
                  <div className="text-left font-black">
                    {viewingPenalty.status === "Approved" ? (
                      <span className="text-emerald-600">✅ معتمد رسمياً بملف الموظف</span>
                    ) : viewingPenalty.status === "Cancelled" ? (
                      <span className="text-slate-600">🚫 ملغى / موقوف ({viewingPenalty.cancellationReason || "بقرار الإدارة"})</span>
                    ) : (
                      <span className="text-blue-600">قيد التدقيق والاعتماد النهائي</span>
                    )}
                  </div>
                </div>
              </div>

              {/* GRIEVANCE PERIOD & VISIBILITY TIMELINE METRICS */}
              {(() => {
                const gInfo = getGrievanceStatusInfo(viewingPenalty);
                return (
                  <div className="p-4 bg-muted/40 border border-border space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                      <span className="font-black text-xs text-foreground flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-indigo-600" />
                        {t("مواعيد التظلم الإداري ومدة الظهور للموظف")}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2.5 py-0.5 text-[10px] font-black rounded-none border",
                          gInfo.status === "submitted"
                            ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30"
                            : gInfo.isAvailable
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                              : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
                        )}>
                          {t("حالة التظلم:")} {gInfo.status === "submitted" ? t("تم التقديم") : (gInfo.isAvailable ? t("متاح") : t("منتهي"))}
                        </span>
                        <span className={cn(
                          "px-2.5 py-0.5 text-[10px] font-black rounded-none border",
                          !gInfo.isVisibilityExpired
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                            : "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30"
                        )}>
                          {t("حالة الظهور:")} {!gInfo.isVisibilityExpired ? t("نشط باللوحة") : t("محفوظ بالسجل التاريخي")}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className="bg-card p-2.5 border border-border">
                        <span className="text-muted-foreground block text-[10px] font-bold mb-0.5">
                          {t("تاريخ بداية التظلم:")}
                        </span>
                        <span className="font-extrabold text-foreground font-mono">
                          {gInfo.gStartDate}
                        </span>
                      </div>

                      <div className="bg-card p-2.5 border border-border">
                        <span className="text-muted-foreground block text-[10px] font-bold mb-0.5">
                          {t("آخر موعد لتقديم التظلم:")}
                        </span>
                        <span className={cn("font-extrabold font-mono", gInfo.isAvailable ? "text-emerald-600" : "text-rose-600")}>
                          {gInfo.gDeadline}
                        </span>
                        <span className="text-[9px] text-muted-foreground block mt-0.5">
                          ({t("مهلة")} {gInfo.gWinDays} {t("أيام")} {gInfo.isAvailable ? `- ${t("متبقي")} ${gInfo.remainingGrievanceDays} ${t("يوم")}` : `- ${t("منتهية")}`})
                        </span>
                      </div>

                      <div className="bg-card p-2.5 border border-border">
                        <span className="text-muted-foreground block text-[10px] font-bold mb-0.5">
                          {t("حالة التظلم:")}
                        </span>
                        <span className={cn("font-black text-xs", gInfo.isAvailable ? "text-emerald-600" : (gInfo.status === "submitted" ? "text-indigo-600" : "text-rose-600"))}>
                          {gInfo.status === "submitted" ? t("تم تقديم التظلم") : (gInfo.isAvailable ? t("متاح") : t("منتهي"))}
                        </span>
                      </div>

                      <div className="bg-card p-2.5 border border-border">
                        <span className="text-muted-foreground block text-[10px] font-bold mb-0.5">
                          {t("تاريخ انتهاء ظهور الجزاء للموظف:")}
                        </span>
                        <span className="font-extrabold text-foreground font-mono">
                          {gInfo.vEndDate}
                        </span>
                        <span className="text-[9px] text-muted-foreground block mt-0.5">
                          ({t("المدة الإجمالية:")} {gInfo.vDurDays} {t("يوماً")})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* GRIEVANCE STATUS & DETAILS SECTION */}
              {viewingPenalty.hasGrievance && (
                <div className="p-4 bg-indigo-500/10 border-2 border-indigo-500/30 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5 text-sm">
                      <Scale className="w-4 h-4" />
                      تظلم إداري مقدم من الموظف
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-900 dark:text-indigo-200">
                      {viewingPenalty.grievanceStatus === "Pending"
                        ? "بانتظار البت من HR"
                        : viewingPenalty.grievanceStatus === "Accepted_Modified"
                          ? "تم قبول التظلم وتعديل الجزاء"
                          : "تم رفض التظلم"}
                    </span>
                  </div>

                  <div className="bg-card p-3 border border-indigo-200/50 space-y-1">
                    <p className="text-muted-foreground font-bold">
                      <strong>تاريخ تقديم التظلم:</strong> {viewingPenalty.grievanceDate || "—"}
                    </p>
                    <p className="text-foreground font-medium">
                      <strong>مضمون وأسباب التظلم:</strong> {viewingPenalty.grievanceReason}
                    </p>
                  </div>

                  {viewingPenalty.grievanceReply && (
                    <div className="bg-card p-3 border border-indigo-200/50 space-y-1">
                      <p className="text-indigo-900 dark:text-indigo-200 font-bold">
                        <strong>رد وقرار إدارة الموارد البشرية ({viewingPenalty.grievanceReviewedBy || "HR"}):</strong>
                      </p>
                      <p className="text-foreground font-medium">{viewingPenalty.grievanceReply}</p>
                    </div>
                  )}

                  {viewingPenalty.grievanceStatus === "Accepted_Modified" && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 border border-border text-[11px] font-bold">
                      <div className="space-y-1 border-l border-border pl-2">
                        <span className="text-muted-foreground block font-black">الجزاء قبل التظلم:</span>
                        <div>النوع: {getPenaltyTypeName(viewingPenalty.preGrievancePenaltyType || viewingPenalty.penaltyType)}</div>
                        <div>الخصم: {viewingPenalty.preGrievanceDeductionValue || 0} {viewingPenalty.preGrievanceDeductionType === "Days" ? "أيام" : "جنيه"}</div>
                      </div>
                      <div className="space-y-1 text-emerald-700 dark:text-emerald-400">
                        <span className="block font-black">الجزاء المعتمد بعد التظلم:</span>
                        <div>النوع: {getPenaltyTypeName(viewingPenalty.postGrievancePenaltyType || viewingPenalty.penaltyType)}</div>
                        <div>الخصم: {viewingPenalty.postGrievanceDeductionValue ?? viewingPenalty.deductionValue} {viewingPenalty.postGrievanceDeductionType === "Days" ? "أيام" : "جنيه"}</div>
                      </div>
                    </div>
                  )}

                  {isHRRole && viewingPenalty.grievanceStatus === "Pending" && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => handleOpenGrievanceReview(viewingPenalty)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-none cursor-pointer flex items-center gap-1.5 shadow"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>البت في التظلم وتعديل الجزاء أو رفضه (HR)</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* AUDIT TRAIL TIMELINE */}
              {Array.isArray(viewingPenalty.auditTrail) &&
                viewingPenalty.auditTrail.length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-border">
                    <span className="text-xs font-black text-muted-foreground block">
                      {t("السجل التتبعي لخطوات الاعتماد (Audit Trail):")}
                    </span>
                    <div className="space-y-2 bg-muted/20 p-4 border border-border max-h-40 overflow-y-auto">
                      {viewingPenalty.auditTrail.map(
                        (log: AuditTrailEntry, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-start justify-between text-[11px] pb-2 border-b border-border/60 last:border-0 last:pb-0"
                          >
                            <div>
                              <span className="font-bold text-foreground block">
                                {log.action} ({log.userName})
                              </span>
                              {log.comment && (
                                <p className="text-muted-foreground text-[10px] mt-0.5">
                                  {log.comment}
                                </p>
                              )}
                            </div>
                            <span className="text-muted-foreground font-semibold dir-ltr text-[10px]">
                              {new Date(log.timestamp).toLocaleString("ar-EG")}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {/* Status and Actions footer (Approve/Return/Reject triggers) */}
              <div className="border-t border-border pt-6 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="text-xs font-bold text-muted-foreground block">
                    {t("الحالة الحالية للجزاء")}
                  </span>
                  <span
                    className={cn(
                      "px-3 py-1 text-xs font-extrabold border block mt-1 inline-block",
                      getStatusBadgeClass(viewingPenalty.status),
                    )}
                  >
                    {getStatusName(viewingPenalty.status)}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {isHRRole && viewingPenalty.status !== "Approved" && viewingPenalty.status !== "Cancelled" && (
                    <>
                      <button
                        onClick={() =>
                          handleUpdateStatus(viewingPenalty, "Approved")
                        }
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black cursor-pointer border-none"
                      >
                        {t("اعتماد نهائي (Approve)")}
                      </button>
                      <button
                        onClick={() => handleCancelOrSuspendPenalty(viewingPenalty)}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-black cursor-pointer border-none"
                      >
                        {t("إلغاء / إيقاف الجزاء")}
                      </button>
                    </>
                  )}

                  {["Draft", "Pending Approval", "Returned"].includes(
                    viewingPenalty.status,
                  ) && (
                    <>
                      <button
                        onClick={() =>
                          setReturnDialogState({
                            isOpen: true,
                            penalty: viewingPenalty,
                            type: "Returned",
                            reason: "",
                          })
                        }
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black cursor-pointer border-none"
                      >
                        {t("إعادة للتعديل (Return)")}
                      </button>
                      <button
                        onClick={() =>
                          setReturnDialogState({
                            isOpen: true,
                            penalty: viewingPenalty,
                            type: "Rejected",
                            reason: "",
                          })
                        }
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black cursor-pointer border-none"
                      >
                        {t("رفض الجزاء (Reject)")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE INVESTIGATION MODAL */}
      {isInvModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-red-600 max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600/10 text-red-600 rounded-none border border-red-600/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-foreground">
                    إنشاء وتوثيق جلسة تحقيق إداري
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    سيتم إرسال تنبيه إداري تلقائي للموظفين المعنيين ومديرهم
                    المباشر
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInvModalOpen(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateInvestigationSubmit}
              className="space-y-4 text-right"
            >
              <div>
                <label className="block text-xs font-black text-foreground mb-1">
                  موضوع / عنوان التحقيق *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تحقيق إداري في عدم الالتزام بضوابط العمل..."
                  value={invFormData.title}
                  onChange={(e) =>
                    setInvFormData((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-foreground mb-1">
                  سبب التحقيق والملاحظات التوجيهية
                </label>
                <textarea
                  rows={3}
                  placeholder="اكتب أسباب التحقيق والتفاصيل للتنبيه الإداري..."
                  value={invFormData.reason}
                  onChange={(e) =>
                    setInvFormData((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    تاريخ التحقيق *
                  </label>
                  <input
                    type="date"
                    required
                    value={invFormData.investigationDate}
                    onChange={(e) =>
                      setInvFormData((prev) => ({
                        ...prev,
                        investigationDate: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    توقيت الجلسة *
                  </label>
                  <input
                    type="time"
                    required
                    value={invFormData.investigationTime}
                    onChange={(e) =>
                      setInvFormData((prev) => ({
                        ...prev,
                        investigationTime: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    مكان / مقر التحقيق
                  </label>
                  <input
                    type="text"
                    value={invFormData.location}
                    onChange={(e) =>
                      setInvFormData((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    اسم المحقق / المستشار
                  </label>
                  <input
                    type="text"
                    value={invFormData.investigatorName}
                    onChange={(e) =>
                      setInvFormData((prev) => ({
                        ...prev,
                        investigatorName: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-foreground mb-2">
                  اختر الموظفين المعنيين للتحقيق *
                </label>
                <div className="bg-muted/30 border border-border p-3 max-h-48 overflow-y-auto space-y-2">
                  {employees.map((emp) => {
                    const isChecked = invFormData.selectedEmployeeIds.includes(
                      emp.id,
                    );
                    return (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInvFormData((prev) => ({
                                ...prev,
                                selectedEmployeeIds: [
                                  ...prev.selectedEmployeeIds,
                                  emp.id,
                                ],
                              }));
                            } else {
                              setInvFormData((prev) => ({
                                ...prev,
                                selectedEmployeeIds:
                                  prev.selectedEmployeeIds.filter(
                                    (id) => id !== emp.id,
                                  ),
                              }));
                            }
                          }}
                          className="accent-red-600 w-4 h-4"
                        />
                        <span>{emp.name}</span>
                        {emp.jobTitle && (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({emp.jobTitle})
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 text-xs cursor-pointer shadow-md"
                >
                  إرسال وتوثيق التحقيق الإداري
                </button>
                <button
                  type="button"
                  onClick={() => setIsInvModalOpen(false)}
                  className="px-6 bg-muted text-foreground font-bold py-3 text-xs cursor-pointer hover:bg-muted/80"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INVESTIGATION RESULT MODAL */}
      {invResultModal.isOpen && invResultModal.investigation && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-red-600/30 rounded-2xl p-6 w-full max-w-lg text-right space-y-4 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-red-600 font-black">
                <FileCheck className="w-5 h-5" />
                <h3 className="text-base">
                  إضافة / تعديل نتيجة التحقيق الإداري والقرارات
                </h3>
              </div>
              <button
                onClick={() =>
                  setInvResultModal({
                    isOpen: false,
                    investigation: null,
                    recommendation: "",
                    notes: "",
                    status: "Completed",
                    saving: false,
                  })
                }
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-muted/40 p-3 rounded-xl border border-border space-y-1 text-xs">
              <p className="font-bold text-foreground">
                <span className="text-muted-foreground">عنوان التحقيق:</span>{" "}
                {invResultModal.investigation.title}
              </p>
              <p className="font-bold text-foreground">
                <span className="text-muted-foreground">رقم التحقيق:</span>{" "}
                <span className="text-red-600 font-mono">
                  {invResultModal.investigation.investigationNumber ||
                    invResultModal.investigation.id}
                </span>
              </p>
              <p className="font-bold text-foreground">
                <span className="text-muted-foreground">الموظف المعني:</span>{" "}
                {invResultModal.investigation.employeeName || "غير محدد"}
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-foreground mb-1.5">
                  القرارات والجزاءات الصادرة ونتيجة جلسة التحقيق{" "}
                  <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={4}
                  value={invResultModal.recommendation}
                  onChange={(e) =>
                    setInvResultModal({
                      ...invResultModal,
                      recommendation: e.target.value,
                    })
                  }
                  placeholder="مثال: تم الاستماع للموظف وتقرر توجيه إنذار كتابي أول مع إغلاق جلسة التحقيق..."
                  className="w-full p-3 bg-muted/20 border border-border rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                />
              </div>

              <div>
                <label className="block font-black text-foreground mb-1.5">
                  حالة جلسة التحقيق
                </label>
                <select
                  value={invResultModal.status}
                  onChange={(e) =>
                    setInvResultModal({
                      ...invResultModal,
                      status: e.target.value as any,
                    })
                  }
                  className="w-full p-2.5 bg-muted/20 border border-border rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-foreground font-bold"
                >
                  <option value="Completed">
                    مكتملة (تم عقد الجلسة وتوثيق القرارات والنتائج)
                  </option>
                  <option value="Scheduled">جلسة مجدولة (قيد الانتظار)</option>
                  <option value="Cancelled">
                    ملغاة (تم حفظ أو إلغاء جلسة التحقيق)
                  </option>
                </select>
              </div>

              <div>
                <label className="block font-black text-foreground mb-1.5">
                  ملاحظات المحقق الإداري الإضافية (اختياري)
                </label>
                <input
                  type="text"
                  value={invResultModal.notes}
                  onChange={(e) =>
                    setInvResultModal({
                      ...invResultModal,
                      notes: e.target.value,
                    })
                  }
                  placeholder="ملاحظات توثيقية إضافية..."
                  className="w-full p-2.5 bg-muted/20 border border-border rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-foreground font-medium"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <button
                disabled={
                  invResultModal.saving || !invResultModal.recommendation.trim()
                }
                onClick={handleSaveInvResult}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                <FileCheck className="w-4 h-4" />
                <span>
                  {invResultModal.saving
                    ? "جاري الحفظ..."
                    : "حفظ نتيجة التحقيق والقرارات"}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setInvResultModal({
                    isOpen: false,
                    investigation: null,
                    recommendation: "",
                    notes: "",
                    status: "Completed",
                    saving: false,
                  })
                }
                className="px-5 bg-muted text-foreground font-bold py-2.5 rounded-xl text-xs hover:bg-muted/80 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RETURN OR REJECTION REASON MODAL */}
      {returnDialogState.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-border p-6 w-full max-w-md text-right space-y-4">
            <h3 className="text-base font-black text-foreground">
              {returnDialogState.type === "Returned"
                ? t("سبب إعادة الجزاء للمراجعة (إجباري)")
                : t("سبب رفض الجزاء (إجباري)")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {returnDialogState.type === "Returned"
                ? t(
                    "يرجى كِتابة تفاصيل الملاحظات أو التعديلات المطلوبة على هذا الجزاء.",
                  )
                : t("يرجى إيضاح سبب رفض توقيع هذا الجزاء الإداري.")}
            </p>
            <textarea
              required
              rows={3}
              value={returnDialogState.reason}
              onChange={(e) =>
                setReturnDialogState({
                  ...returnDialogState,
                  reason: e.target.value,
                })
              }
              className="w-full text-xs p-3 bg-muted/30 border border-border focus:ring-2 focus:ring-red-600 outline-none text-foreground"
              placeholder={t("اكتب التوضيح والملاحظات هنا...")}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!returnDialogState.reason.trim()) {
                    alert(t("يرجى كِتابة سبب الإجراء للمتابعة"));
                    return;
                  }
                  handleUpdateStatus(
                    returnDialogState.penalty,
                    returnDialogState.type,
                    returnDialogState.reason,
                  );
                }}
                className={`flex-1 font-black py-2 text-white text-xs cursor-pointer ${returnDialogState.type === "Returned" ? "bg-amber-600 hover:bg-amber-700" : "bg-rose-600 hover:bg-rose-700"}`}
              >
                {returnDialogState.type === "Returned"
                  ? t("تأكيد الإعادة للمراجعة")
                  : t("تأكيد رفض الجزاء")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setReturnDialogState({
                    isOpen: false,
                    penalty: null,
                    type: "Returned",
                    reason: "",
                  })
                }
                className="px-4 bg-muted text-foreground font-bold py-2 text-xs cursor-pointer"
              >
                {t("إلغاء")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT INVESTIGATION MODAL */}
      {editInvModal.isOpen && editInvModal.investigation && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-amber-600 max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-600/10 text-amber-600 rounded-none border border-amber-600/20">
                  <Edit3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-foreground">
                    تعديل جلسة التحقيق الإداري
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    سيتم تحديث التنبيه الإداري الموجه المرتبط تلقائياً
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setEditInvModal((prev) => ({
                    ...prev,
                    isOpen: false,
                    investigation: null,
                  }))
                }
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleUpdateInvestigation}
              className="space-y-4 text-right"
            >
              <div>
                <label className="block text-xs font-black text-foreground mb-1">
                  موضوع / عنوان التحقيق *
                </label>
                <input
                  type="text"
                  required
                  placeholder="عنوان التحقيق الإداري..."
                  value={editInvModal.title}
                  onChange={(e) =>
                    setEditInvModal((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-foreground mb-1">
                  سبب التحقيق والملاحظات
                </label>
                <textarea
                  rows={3}
                  placeholder="أسباب التحقيق والتفاصيل..."
                  value={editInvModal.reason}
                  onChange={(e) =>
                    setEditInvModal((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    تاريخ التحقيق *
                  </label>
                  <input
                    type="date"
                    required
                    value={editInvModal.investigationDate}
                    onChange={(e) =>
                      setEditInvModal((prev) => ({
                        ...prev,
                        investigationDate: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    توقيت الجلسة *
                  </label>
                  <input
                    type="time"
                    required
                    value={editInvModal.investigationTime}
                    onChange={(e) =>
                      setEditInvModal((prev) => ({
                        ...prev,
                        investigationTime: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    مكان التحقيق
                  </label>
                  <input
                    type="text"
                    value={editInvModal.location}
                    onChange={(e) =>
                      setEditInvModal((prev) => ({
                        ...prev,
                        location: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    اسم المحقق / المستشار
                  </label>
                  <input
                    type="text"
                    value={editInvModal.investigatorName}
                    onChange={(e) =>
                      setEditInvModal((prev) => ({
                        ...prev,
                        investigatorName: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-foreground mb-2">
                  اختر الموظفين المعنيين بالتحقيق *
                </label>
                <div className="bg-muted/30 border border-border p-3 max-h-48 overflow-y-auto space-y-2">
                  {employees.map((emp) => {
                    const isChecked =
                      editInvModal.selectedEmployeeIds.includes(emp.id) ||
                      editInvModal.selectedEmployeeIds.includes(emp.employeeId);
                    return (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditInvModal((prev) => ({
                                ...prev,
                                selectedEmployeeIds: [
                                  ...prev.selectedEmployeeIds,
                                  emp.id,
                                ],
                              }));
                            } else {
                              setEditInvModal((prev) => ({
                                ...prev,
                                selectedEmployeeIds:
                                  prev.selectedEmployeeIds.filter(
                                    (id) =>
                                      id !== emp.id && id !== emp.employeeId,
                                  ),
                              }));
                            }
                          }}
                          className="accent-amber-600 w-4 h-4"
                        />
                        <span>{emp.name}</span>
                        {emp.jobTitle && (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({emp.jobTitle})
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <button
                  type="submit"
                  disabled={editInvModal.saving}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black py-3 text-xs cursor-pointer shadow-md"
                >
                  {editInvModal.saving
                    ? "جاري التعديل..."
                    : "حفظ وتأكيد التعديلات"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditInvModal((prev) => ({
                      ...prev,
                      isOpen: false,
                      investigation: null,
                    }))
                  }
                  className="px-6 bg-muted text-foreground font-bold py-3 text-xs cursor-pointer hover:bg-muted/80"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NOTICE MODAL */}
      {createNoticeModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-red-600 max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600/10 text-red-600 rounded-none border border-red-600/20">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-foreground">
                    إنشاء ونشر تنبيه إداري موجه
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    سيتم إرسال التنبيه للمستهدفين ومديريهم المباشرين مباشرة
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setCreateNoticeModal((prev) => ({ ...prev, isOpen: false }))
                }
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateNoticeSubmit}
              className="space-y-4 text-right"
            >
              <div>
                <label className="block text-xs font-black text-foreground mb-1">
                  عنوان التنبيه الإداري *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تنبيه إداري بشأن الالتزام بالتعليمات..."
                  value={createNoticeModal.title}
                  onChange={(e) =>
                    setCreateNoticeModal((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-foreground mb-1">
                  محتوى التنبيه والإرشادات *
                </label>
                <RichTextEditor
                  id="create-notice-content-editor"
                  value={createNoticeModal.content}
                  onChange={(html) =>
                    setCreateNoticeModal((prev) => ({
                      ...prev,
                      content: html,
                    }))
                  }
                  placeholder="اكتب نص ومحتوى التنبيه الإداري التفصيلي..."
                  themeColor="red"
                  minHeight="160px"
                  maxHeight="320px"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    الفئة
                  </label>
                  <select
                    value={createNoticeModal.category}
                    onChange={(e) =>
                      setCreateNoticeModal((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-red-600"
                  >
                    <option value="general">عام / تعليمات إدارية</option>
                    <option value="warning">تنبيه / تحذير رسمية</option>
                    <option value="urgent">عاجل / طارئ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    الأولوية
                  </label>
                  <select
                    value={createNoticeModal.priority}
                    onChange={(e) =>
                      setCreateNoticeModal((prev) => ({
                        ...prev,
                        priority: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-red-600"
                  >
                    <option value="normal">عادي</option>
                    <option value="urgent">عاجل ورسمي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    تاريخ النشر
                  </label>
                  <input
                    type="date"
                    value={createNoticeModal.noticeDate}
                    onChange={(e) =>
                      setCreateNoticeModal((prev) => ({
                        ...prev,
                        noticeDate: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-red-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-foreground mb-2">
                  توجيه التنبيه لموظفين محددين (أتركه فارغاً لإرساله للجميع)
                </label>
                <div className="bg-muted/30 border border-border p-3 max-h-48 overflow-y-auto space-y-2">
                  {employees.map((emp) => {
                    const isChecked =
                      createNoticeModal.selectedEmployeeIds.includes(emp.id) ||
                      createNoticeModal.selectedEmployeeIds.includes(
                        emp.employeeId,
                      );
                    return (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCreateNoticeModal((prev) => ({
                                ...prev,
                                selectedEmployeeIds: [
                                  ...prev.selectedEmployeeIds,
                                  emp.id,
                                ],
                              }));
                            } else {
                              setCreateNoticeModal((prev) => ({
                                ...prev,
                                selectedEmployeeIds:
                                  prev.selectedEmployeeIds.filter(
                                    (id) =>
                                      id !== emp.id && id !== emp.employeeId,
                                  ),
                              }));
                            }
                          }}
                          className="accent-red-600 w-4 h-4"
                        />
                        <span>{emp.name}</span>
                        {emp.jobTitle && (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            ({emp.jobTitle})
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <button
                  type="submit"
                  disabled={createNoticeModal.saving}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-3 text-xs cursor-pointer shadow-md"
                >
                  {createNoticeModal.saving
                    ? "جاري النشر..."
                    : "نشر التنبيه الإداري"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCreateNoticeModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="px-6 bg-muted text-foreground font-bold py-3 text-xs cursor-pointer hover:bg-muted/80"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT NOTICE MODAL */}
      {editNoticeModal.isOpen && editNoticeModal.notice && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-amber-600 max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-600/10 text-amber-600 rounded-none border border-amber-600/20">
                  <Edit3 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-foreground">
                    تعديل التنبيه الإداري الموجه
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    تحديث تفاصيل التنبيه أو الجمهور المستهدف
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  setEditNoticeModal((prev) => ({
                    ...prev,
                    isOpen: false,
                    notice: null,
                  }))
                }
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleUpdateNotice}
              className="space-y-4 text-right"
            >
              <div>
                <label className="block text-xs font-black text-foreground mb-1">
                  عنوان التنبيه الإداري *
                </label>
                <input
                  type="text"
                  required
                  value={editNoticeModal.title}
                  onChange={(e) =>
                    setEditNoticeModal((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-foreground mb-1">
                  محتوى التنبيه *
                </label>
                <RichTextEditor
                  id="edit-notice-content-editor"
                  value={editNoticeModal.content}
                  onChange={(html) =>
                    setEditNoticeModal((prev) => ({
                      ...prev,
                      content: html,
                    }))
                  }
                  placeholder="اكتب تفاصيل ومحتوى التنبيه الإداري هنا..."
                  themeColor="amber"
                  minHeight="200px"
                  maxHeight="380px"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    الفئة
                  </label>
                  <select
                    value={editNoticeModal.category}
                    onChange={(e) =>
                      setEditNoticeModal((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-600"
                  >
                    <option value="general">عام / تعليمات إدارية</option>
                    <option value="warning">تنبيه / تحذير رسمية</option>
                    <option value="investigation">جلسة تحقيق إداري</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    الأولوية
                  </label>
                  <select
                    value={editNoticeModal.priority}
                    onChange={(e) =>
                      setEditNoticeModal((prev) => ({
                        ...prev,
                        priority: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-600"
                  >
                    <option value="normal">عادي</option>
                    <option value="urgent">عاجل ورسمي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-foreground mb-1">
                    تاريخ النشر
                  </label>
                  <input
                    type="date"
                    value={editNoticeModal.noticeDate}
                    onChange={(e) =>
                      setEditNoticeModal((prev) => ({
                        ...prev,
                        noticeDate: e.target.value,
                      }))
                    }
                    className="w-full bg-input border border-border p-2.5 text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-amber-600"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-border">
                <button
                  type="submit"
                  disabled={editNoticeModal.saving}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black py-3 text-xs cursor-pointer shadow-md"
                >
                  {editNoticeModal.saving
                    ? "جاري التعديل..."
                    : "حفظ ونشر التعديلات"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditNoticeModal((prev) => ({
                      ...prev,
                      isOpen: false,
                      notice: null,
                    }))
                  }
                  className="px-6 bg-muted text-foreground font-bold py-3 text-xs cursor-pointer hover:bg-muted/80"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HR GRIEVANCE REVIEW MODAL */}
      {grievanceReviewModal.isOpen && grievanceReviewModal.penalty && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card border-2 border-indigo-600 max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-right">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5 text-indigo-600 font-black">
                <Scale className="w-6 h-6" />
                <div>
                  <h3 className="text-base text-foreground font-black">
                    البت في التظلم الإداري المقدم من الموظف
                  </h3>
                  <p className="text-xs text-muted-foreground font-bold">
                    رقم الجزاء: {grievanceReviewModal.penalty.penaltyNumber || grievanceReviewModal.penalty.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGrievanceReviewModal((prev) => ({ ...prev, isOpen: false }))}
                className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Grievance info block */}
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 space-y-1.5 rounded-none">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-indigo-900 dark:text-indigo-200">
                    الموظف المتظلم: {employees.find((e) => e.id === grievanceReviewModal.penalty.employeeId)?.name || grievanceReviewModal.penalty.employeeName || "الموظف"}
                  </span>
                  <span className="text-muted-foreground">{grievanceReviewModal.penalty.grievanceDate}</span>
                </div>
                <div className="font-bold text-foreground">
                  <strong>الجزاء الأصلي:</strong> {getPenaltyTypeName(grievanceReviewModal.penalty.penaltyType)}
                  {grievanceReviewModal.penalty.deductionValue > 0 &&
                    ` (${grievanceReviewModal.penalty.deductionValue} ${grievanceReviewModal.penalty.deductionType === "Days" ? "أيام" : "جنيه"})`}
                </div>
                <div className="bg-card p-2.5 border border-indigo-200 text-foreground font-medium whitespace-pre-wrap">
                  <strong>مضمون التظلم:</strong> {grievanceReviewModal.penalty.grievanceReason}
                </div>
              </div>

              {/* Action Selector */}
              <div>
                <label className="block font-black text-foreground mb-1.5">
                  قرار إدارة الموارد البشرية (HR) *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGrievanceReviewModal((prev) => ({ ...prev, action: "Accepted_Modified" }))}
                    className={cn(
                      "p-3 text-center border-2 font-black text-xs cursor-pointer transition-all",
                      grievanceReviewModal.action === "Accepted_Modified"
                        ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    ✅ قبول التظلم وتعديل الجزاء
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrievanceReviewModal((prev) => ({ ...prev, action: "Rejected" }))}
                    className={cn(
                      "p-3 text-center border-2 font-black text-xs cursor-pointer transition-all",
                      grievanceReviewModal.action === "Rejected"
                        ? "border-rose-600 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    ❌ رفض التظلم والإبقاء على الجزاء
                  </button>
                </div>
              </div>

              {/* If Accepted, Modification Controls */}
              {grievanceReviewModal.action === "Accepted_Modified" && (
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                  <span className="font-black text-emerald-800 dark:text-emerald-300 block">
                    تعديل الجزاء بعد قبول التظلم:
                  </span>
                  
                  <div>
                    <label className="block font-bold text-foreground mb-1">
                      نوع الجزاء المخفف / المعدل *
                    </label>
                    <select
                      value={grievanceReviewModal.newPenaltyType}
                      onChange={(e) =>
                        setGrievanceReviewModal((prev) => ({
                          ...prev,
                          newPenaltyType: e.target.value,
                        }))
                      }
                      className="w-full p-2.5 bg-card border border-border text-foreground font-bold focus:ring-1 focus:ring-emerald-600 outline-none"
                    >
                      <option value="Notice">لفت نظر شفهي / إداري</option>
                      <option value="Warning">إنذار كتابي</option>
                      <option value="Final Warning">إنذار نهائي بالفصل</option>
                      <option value="Day Deduction">خصم أيام عمل من الراتب</option>
                      <option value="Amount Deduction">خصم مالي مباشر (جنيه مصري)</option>
                      <option value="Suspension">إيقاف مؤقت عن العمل مع الحرمان</option>
                    </select>
                  </div>

                  {["Day Deduction", "Amount Deduction"].includes(grievanceReviewModal.newPenaltyType) && (
                    <div>
                      <label className="block font-bold text-foreground mb-1">
                        {grievanceReviewModal.newPenaltyType === "Day Deduction"
                          ? "عدد أيام الخصم المعدلة"
                          : "قيمة الخصم بالجنيه المصري"}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={grievanceReviewModal.newDeductionValue}
                        onChange={(e) =>
                          setGrievanceReviewModal((prev) => ({
                            ...prev,
                            newDeductionValue: Number(e.target.value) || 0,
                          }))
                        }
                        className="w-full p-2.5 bg-card border border-border text-foreground font-black focus:ring-1 focus:ring-emerald-600 outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Reply / Justification */}
              <div>
                <label className="block font-black text-foreground mb-1">
                  مبررات وتفاصيل قرار إدارة الموارد البشرية *
                </label>
                <textarea
                  rows={3}
                  required
                  value={grievanceReviewModal.reply}
                  onChange={(e) =>
                    setGrievanceReviewModal((prev) => ({
                      ...prev,
                      reply: e.target.value,
                    }))
                  }
                  placeholder="اكتب أسباب القرار وحيثيات قبول التظلم أو رفضه ليتم إخطار الموظف وتوثيقها بملفه..."
                  className="w-full p-3 bg-muted/20 border border-border text-foreground font-medium focus:ring-2 focus:ring-indigo-600 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <button
                type="button"
                disabled={grievanceReviewModal.saving || !grievanceReviewModal.reply.trim()}
                onClick={handleProcessGrievance}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black py-2.5 text-xs cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>
                  {grievanceReviewModal.saving
                    ? "جاري الحفظ والاعتماد..."
                    : "اعتماد القرار وتحديث الجزاء والإشعار"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setGrievanceReviewModal((prev) => ({ ...prev, isOpen: false }))}
                className="px-5 bg-muted text-foreground font-bold py-2.5 text-xs cursor-pointer hover:bg-muted/80"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW NOTICE DOCUMENT MODAL */}
      {viewNoticeModal.isOpen && viewNoticeModal.notice && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto text-right">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600/10 text-red-600 rounded-xl border border-red-600/20">
                  <Megaphone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg text-foreground">
                    {viewNoticeModal.notice.title}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    تاريخ النشر: {viewNoticeModal.notice.noticeDate || viewNoticeModal.notice.createdAt?.split("T")[0] || "—"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewNoticeModal({ isOpen: false, notice: null })}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formatted Notice Content */}
            <div
              className="prose dark:prose-invert max-w-none text-foreground text-xs md:text-sm font-medium leading-relaxed bg-muted/20 p-5 rounded-xl border border-border"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(viewNoticeModal.notice.content),
              }}
            />

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-xs text-muted-foreground font-bold">
                الجهة المصدرة: {viewNoticeModal.notice.createdByName || viewNoticeModal.notice.createdBy || "الشؤون القانونية"}
              </span>
              <button
                type="button"
                onClick={() => setViewNoticeModal({ isOpen: false, notice: null })}
                className="px-6 bg-red-600 hover:bg-red-700 text-white font-black py-2 text-xs rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
