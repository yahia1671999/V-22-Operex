import React, { useState, useMemo, useCallback } from 'react';
import { 
  Plane, 
  Settings, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar,
  Search,
  Filter,
  DollarSign,
  Briefcase,
  Eye,
  Award,
  Star,
  FileText,
  User,
  X
} from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc } from '../../api';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../AuthContext';
import { Mission, MissionType, MissionAllowance, Employee, MissionEvaluation } from '../../types';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatCurrency } from '../../lib/utils';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { MissionEvaluationModal } from '../common/MissionEvaluationModal';
import { usePermissions } from '../../hooks/usePermissions';
import { useLanguage } from '../../contexts/LanguageContext';

export interface MissionAllowanceCalculation {
  days: number;
  allowances: MissionAllowance[];
  dailyRate: number;
  onceTotal: number;
  totalAmount: number;
  breakdown: Array<{
    name: string;
    amount: number;
    type: 'Daily' | 'Once';
    daysApplied: number;
    subtotal: number;
    formulaText: string;
  }>;
}

export function calculateMissionAllowances(
  mission: { startDate?: string; endDate?: string; allowances?: any; missionTypeId?: string; projectId?: string },
  missionTypesList: MissionType[] = []
): MissionAllowanceCalculation {
  let days = 1;
  if (mission.startDate && mission.endDate) {
    const start = new Date(mission.startDate);
    const end = new Date(mission.endDate);
    const diffTime = end.getTime() - start.getTime();
    days = isNaN(diffTime) || diffTime < 0 ? 1 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  let rawAllowances = mission.allowances;
  let parsedAllowances: any[] = [];
  if (typeof rawAllowances === 'string') {
    try { parsedAllowances = JSON.parse(rawAllowances); } catch (e) { parsedAllowances = []; }
  } else if (Array.isArray(rawAllowances)) {
    parsedAllowances = rawAllowances;
  }

  // If no custom allowances on mission, lookup from MissionType in Cost Matrix
  if (!parsedAllowances || parsedAllowances.length === 0) {
    let matchedType = missionTypesList.find(t => t.id === mission.missionTypeId);
    if (!matchedType && mission.projectId) {
      matchedType = missionTypesList.find(t => Array.isArray(t.projectIds) && t.projectIds.includes(mission.projectId!));
    }
    if (matchedType) {
      const typeAllowances = matchedType.allowances;
      if (typeof typeAllowances === 'string') {
        try { parsedAllowances = JSON.parse(typeAllowances); } catch (e) { parsedAllowances = []; }
      } else if (Array.isArray(typeAllowances)) {
        parsedAllowances = typeAllowances;
      }
    }
  }

  let dailyRate = 0;
  let onceTotal = 0;
  let totalAmount = 0;
  const breakdown = (parsedAllowances || []).map((a: any) => {
    const amt = Number(a.amount) || 0;
    const isDaily = a.type === 'Daily' || a.type === 'يومي';
    const subtotal = isDaily ? amt * days : amt;
    const typeNormalized: 'Daily' | 'Once' = isDaily ? 'Daily' : 'Once';
    if (isDaily) {
      dailyRate += amt;
    } else {
      onceTotal += amt;
    }
    totalAmount += subtotal;
    return {
      name: a.name || 'بدل',
      amount: amt,
      type: typeNormalized,
      daysApplied: isDaily ? days : 1,
      subtotal,
      formulaText: isDaily ? `${amt} × ${days} يوم = ${subtotal}` : `${amt} (مرة واحدة)`
    };
  });

  return {
    days,
    allowances: parsedAllowances || [],
    dailyRate,
    onceTotal,
    totalAmount,
    breakdown
  };
}

export const Missions: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { employees, missions, missionTypes, projects, refreshData } = useData();
  const { user, profile, isAdmin, isHR } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = usePermissions();

  const currentEmployee = useMemo(() => {
    if (!user && !profile) return null;
    const userEmail = (user?.email || (profile as any)?.email || '').toLowerCase().trim();
    const userId = user?.uid || profile?.id;

    return employees.find(e => 
      (e.id && e.id === userId) ||
      (e.email && e.email.toLowerCase().trim() === userEmail) ||
      (e.userId && e.userId === userId) ||
      (e.employeeId && (profile as any)?.employeeId && e.employeeId === (profile as any)?.employeeId)
    ) || (profile as any);
  }, [profile, user, employees]);

  const currentEmpIdentifiers = useMemo(() => {
    const ids: string[] = [];
    if (currentEmployee) {
      if (currentEmployee.id) ids.push(String(currentEmployee.id).trim().toLowerCase());
      if (currentEmployee.employeeId) ids.push(String(currentEmployee.employeeId).trim().toLowerCase());
      if (currentEmployee.userId) ids.push(String(currentEmployee.userId).trim().toLowerCase());
      if (currentEmployee.email) ids.push(String(currentEmployee.email).trim().toLowerCase());
      if (currentEmployee.name) ids.push(String(currentEmployee.name).trim().toLowerCase());
    }
    if (user?.uid) ids.push(String(user.uid).trim().toLowerCase());
    if (user?.email) ids.push(String(user.email).trim().toLowerCase());
    if (profile?.id) ids.push(String(profile.id).trim().toLowerCase());
    if ((profile as any)?.employeeId) ids.push(String((profile as any).employeeId).trim().toLowerCase());
    return Array.from(new Set(ids.filter(Boolean)));
  }, [currentEmployee, user, profile]);

  const [scopeFilter, setScopeFilter] = useState<'all' | 'my_own'>(() => {
    return (isAdmin || isHR) ? 'all' : 'my_own';
  });
  const [viewingDetailsMission, setViewingDetailsMission] = useState<Mission | null>(null);
  const [evaluatingMission, setEvaluatingMission] = useState<Mission | null>(null);

  const isMyMission = useCallback((m: Mission) => {
    const mEmpId = String(m.employeeId || '').trim().toLowerCase();
    if (!mEmpId) return false;

    // Check if it's strictly the current user's mission
    const isDirectlyMine = currentEmpIdentifiers.includes(mEmpId) || employees.some(e => {
      const isThisEmp = String(e.id).trim().toLowerCase() === mEmpId || String(e.employeeId).trim().toLowerCase() === mEmpId;
      if (!isThisEmp) return false;
      const empIds = [e.id, e.employeeId, e.userId, e.email].filter(Boolean).map(x => String(x).trim().toLowerCase());
      return empIds.some(id => currentEmpIdentifiers.includes(id));
    });

    if (scopeFilter === 'my_own') {
      return isDirectlyMine;
    }

    // Only Admin or HR Manager can view other employees' missions when scopeFilter === 'all'
    if (isAdmin || isHR) return true;

    return isDirectlyMine;
  }, [isAdmin, isHR, currentEmpIdentifiers, employees, scopeFilter]);

  const handleSaveEvaluation = async (missionId: string, evaluation: MissionEvaluation, markCompleted: boolean) => {
    try {
      const mission = missions.find(m => m.id === missionId);
      if (!mission) return;
      const updatedStatus = markCompleted ? 'Completed' : mission.status;
      const res = await fetch(`/api/missions/${missionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          ...mission,
          status: updatedStatus,
          evaluation: JSON.stringify(evaluation)
        })
      });
      if (res.ok) {
        await refreshData();
        setEvaluatingMission(null);
        if (viewingDetailsMission && viewingDetailsMission.id === missionId) {
          setViewingDetailsMission({
            ...viewingDetailsMission,
            status: updatedStatus,
            evaluation
          });
        }
      } else {
        const err = await res.json();
        alert(err.error || 'فشل حفظ التقييم');
      }
    } catch (e: any) {
      alert('حدث خطأ أثناء حفظ التقييم');
    }
  };

  const [activeTab, setActiveTab] = useState<'missions' | 'types'>('missions');
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'general' | 'project'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'mission' | 'type', show: boolean }>({ id: '', type: 'mission', show: false });
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [editingType, setEditingType] = useState<MissionType | null>(null);

  // Mission Form State
  const [missionForm, setMissionForm] = useState<Omit<Mission, 'id'>>({
    employeeId: '',
    projectId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    missionTypeId: '',
    status: 'Pending',
    notes: '',
    allowances: []
  });

  // Type Form State
  const [typeForm, setTypeForm] = useState<Omit<MissionType, 'id'>>({
    name: '',
    allowances: [],
    projectIds: []
  });

  const handleEditMission = (m: Mission) => {
    setEditingMission(m);
    
    const rawAllowances = m.allowances;
    const allowances = Array.isArray(rawAllowances) 
      ? rawAllowances 
      : (typeof rawAllowances === 'string' ? JSON.parse(rawAllowances) : []);

    setMissionForm({
      employeeId: m.employeeId,
      projectId: m.projectId || '',
      startDate: m.startDate,
      endDate: m.endDate,
      missionTypeId: m.missionTypeId,
      status: m.status,
      notes: m.notes || '',
      allowances: Array.isArray(allowances) ? allowances.map((a: any) => ({ ...a })) : []
    });
    setIsMissionModalOpen(true);
  };

  const handleCloseMissionModal = () => {
    setIsMissionModalOpen(false);
    setEditingMission(null);
    setMissionForm({
      employeeId: '',
      projectId: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      missionTypeId: '',
      status: 'Pending',
      notes: '',
      allowances: []
    });
  };

  const handleEditType = (type: MissionType) => {
    setEditingType(type);
    
    const rawAllowances = type.allowances;
    const allowances = Array.isArray(rawAllowances) 
      ? rawAllowances 
      : (typeof rawAllowances === 'string' ? JSON.parse(rawAllowances) : []);

    setTypeForm({
      name: type.name,
      allowances: Array.isArray(allowances) ? allowances.map((a: any) => ({ ...a, id: a.id || crypto.randomUUID() })) : [],
      projectIds: Array.isArray(type.projectIds) ? [...type.projectIds] : []
    });
    setIsTypeModalOpen(true);
  };

  const handleCloseTypeModal = () => {
    setIsTypeModalOpen(false);
    setEditingType(null);
    setTypeForm({ name: '', allowances: [], projectIds: [] });
  };

  const handleOpenNewMissionModal = () => {
    setEditingMission(null);
    const myEmpId = (!isAdmin && !isHR && currentEmployee?.id) ? currentEmployee.id : '';
    setMissionForm({
      employeeId: myEmpId,
      projectId: '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      missionTypeId: '',
      status: 'Pending',
      notes: '',
      allowances: []
    });
    setIsMissionModalOpen(true);
  };

  const handleAddMission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = editingMission?.id || crypto.randomUUID();
      const targetEmpId = (!isAdmin && !isHR && currentEmployee?.id) ? currentEmployee.id : missionForm.employeeId;
      if (!targetEmpId) {
        alert(t('يرجى اختيار الموظف'));
        return;
      }
      
      // Sanitize foreign keys: convert empty strings to null
      const sanitizedMission = {
        ...missionForm,
        employeeId: targetEmpId,
        id,
        projectId: missionForm.projectId || null,
        missionTypeId: missionForm.missionTypeId || null
      };

      await setDoc(doc(db, 'missions', id), sanitizedMission);
      await refreshData();
      setIsMissionModalOpen(false);
      setEditingMission(null);
      setMissionForm({
        employeeId: '',
        projectId: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        missionTypeId: '',
        status: 'Pending',
        notes: '',
        allowances: []
      });
    } catch (err: any) {
      alert("حدث خطأ أثناء حفظ المأمورية: " + err.message);
    }
  };

  const handleUpdateStatus = async (id: string, status: Mission['status']) => {
    await setDoc(doc(db, 'missions', id), { status }, { merge: true });
    await refreshData();
  };

  const handleDeleteMission = async (id: string) => {
    setDeleteConfirm({ id, type: 'mission', show: true });
  };

  const confirmDeleteMission = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'missions', id));
      await refreshData();
    } catch (error: any) {
      alert('لا توجد صلاحية لحذف المأمورية: ' + error.message);
    }
  };

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const id = editingType?.id || crypto.randomUUID();
      await setDoc(doc(db, 'missionTypes', id), { ...typeForm, id });
      await refreshData();
      setIsTypeModalOpen(false);
      setEditingType(null);
      setTypeForm({ name: '', allowances: [], projectIds: [] });
    } catch (err: any) {
      alert("حدث خطأ أثناء حفظ نوع المأمورية: " + err.message);
    }
  };

  const handleDeleteType = async (id: string) => {
    setDeleteConfirm({ id, type: 'type', show: true });
  };

  const confirmDeleteType = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'missionTypes', id));
      await refreshData();
    } catch (error: any) {
      alert('لا توجد صلاحية لحذف النوع: ' + error.message);
    }
  };

  const hasViewAccess = canView('missions');

  const isGeneralMission = (m: Mission) => {
    if (!m.projectId || m.projectId === '' || m.projectId === 'null' || m.projectId === 'undefined') {
      return true;
    }
    if (m.projectId === 'general_tasks_project') {
      return true;
    }
    const proj = projects.find(p => p.id === m.projectId);
    if (proj) {
      const projName = (proj.name || '').toLowerCase();
      if (projName.includes('عامة') || projName.includes('تكليف') || projName.includes('مباشر') || projName.includes('افتراضي')) {
        return true;
      }
    }
    const type = missionTypes.find(t => t.id === m.missionTypeId);
    if (type) {
      const typeName = (type.name || '').toLowerCase();
      if (typeName.includes('عامة') || typeName.includes('تكليف') || typeName.includes('مباشر')) {
        return true;
      }
    }
    return false;
  };

  const filteredMissions = useMemo(() => {
    if (!hasViewAccess) return [];
    return missions
      .filter(m => {
        if (!isMyMission(m)) return false;

        const isGeneral = isGeneralMission(m);
        if (filterCategory === 'general' && !isGeneral) return false;
        if (filterCategory === 'project' && isGeneral) return false;

        const emp = employees.find(e => e.id === m.employeeId);
        const type = missionTypes.find(t => t.id === m.missionTypeId);
        const proj = projects.find(p => p.id === m.projectId);
        const searchLower = searchTerm.toLowerCase();
        return (
          (emp?.name || '').toLowerCase().includes(searchLower) ||
          (emp?.employeeId || '').toLowerCase().includes(searchLower) ||
          (type?.name || '').toLowerCase().includes(searchLower) ||
          (proj?.name || '').toLowerCase().includes(searchLower) ||
          (m.notes || '').toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [missions, employees, missionTypes, projects, searchTerm, filterCategory, hasViewAccess, isMyMission]);

  if (!hasViewAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-card border border-border text-center">
        <p className="text-lg font-black text-destructive uppercase tracking-widest leading-relaxed">{t('عذرًا، ليس لديك صلاحيات كافية لزيارة هذه الصفحة.')}</p>
        <p className="text-xs font-bold text-muted-foreground mt-2 italic">{t('يرجى التواصل مع إدارة النظام لتفعيل الصلاحية المطلوبة.')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-card p-10 rounded-none border-2 border-primary shadow-[8px_8px_0px_0px_rgba(37,99,235,0.1)]">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-primary/10 rounded-none flex items-center justify-center text-primary border-2 border-primary/20 shadow-inner">
            <Plane className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-foreground uppercase tracking-widest leading-none">{t('إدارة المأموريات الذكية')}</h2>
            <div className="h-1 w-24 bg-primary mt-3" />
            <p className="text-muted-foreground font-black mt-3 uppercase text-xs tracking-widest opacity-80">{t('سجل متكامل للعمليات الخارجية والتمثيل المؤسسي')}</p>
          </div>
        </div>
        {canCreate('missions') && (
          <div className="flex gap-4">
            <button 
              onClick={handleOpenNewMissionModal}
              className="px-10 py-5 bg-primary text-primary-foreground font-black rounded-none hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center gap-3 active:scale-95 text-sm uppercase tracking-[0.2em]"
            >
              <Plus className="w-6 h-6" />{t('فتح مأمورية جديدة')}</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-3 p-1.5 bg-muted/50 rounded-none w-fit border-2 border-border/40 shadow-inner">
        <button 
          onClick={() => setActiveTab('missions')}
          className={cn(
            "px-10 py-3 rounded-none text-xs font-black transition-all uppercase tracking-widest",
            activeTab === 'missions' ? "bg-card text-primary shadow-md border border-border" : "text-muted-foreground hover:text-foreground"
          )}
        >{t('سجلات الحركة')}</button>
        {canEdit('missions') && (
          <button 
            onClick={() => setActiveTab('types')}
            className={cn(
              "px-10 py-3 rounded-none text-xs font-black transition-all uppercase tracking-widest",
              activeTab === 'types' ? "bg-card text-primary shadow-md border border-border" : "text-muted-foreground hover:text-foreground"
            )}
          >{t('مصفوفة التكاليف')}</button>
        )}
      </div>

      {activeTab === 'missions' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
             <div className="relative flex-1">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <input 
                  type="text" 
                  placeholder={t('بحث في المأموريات...')}
                  className="w-full pr-12 pl-4 py-4 bg-card border border-border rounded-none shadow-sm outline-none focus:ring-2 focus:ring-primary font-medium text-foreground placeholder:text-muted-foreground/50"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => setScopeFilter('my_own')} 
                  className={cn(
                    "px-4 py-3.5 text-xs font-black border transition-all rounded-none flex items-center gap-1.5 cursor-pointer",
                    scopeFilter === 'my_own' ? "bg-red-600 text-white border-red-700 shadow-sm" : "bg-card text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  <User className="w-4 h-4" />
                  <span>مأمورياتي الخاصة</span>
                </button>

                {(isAdmin || isHR) && (
                  <button 
                    onClick={() => setScopeFilter('all')} 
                    className={cn(
                      "px-4 py-3.5 text-xs font-black border transition-all rounded-none flex items-center gap-1.5 cursor-pointer",
                      scopeFilter === 'all' ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    <Briefcase className="w-4 h-4" />
                    <span>جميع مأموريات المؤسسة</span>
                  </button>
                )}

                <div className="h-6 w-px bg-border mx-1 hidden sm:block" />

                <button 
                  onClick={() => setFilterCategory('all')} 
                  className={cn(
                    "px-4 py-3.5 text-xs font-black border transition-all rounded-none cursor-pointer",
                    filterCategory === 'all' ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {t('الكل')}
                </button>
                <button 
                  onClick={() => setFilterCategory('general')} 
                  className={cn(
                    "px-4 py-3.5 text-xs font-black border transition-all rounded-none flex items-center gap-1.5 cursor-pointer",
                    filterCategory === 'general' ? "bg-amber-500 text-white border-amber-600" : "bg-card text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                  )}
                >
                  <span>{t('المأموريات العامة')}</span>
                </button>
                <button 
                  onClick={() => setFilterCategory('project')} 
                  className={cn(
                    "px-4 py-3.5 text-xs font-black border transition-all rounded-none cursor-pointer",
                    filterCategory === 'project' ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {t('مأموريات المشاريع')}
                </button>
             </div>
          </div>

          <div className="bg-card rounded-none border-2 border-border/80 overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-muted/80 border-b-2 border-border/60 text-xs font-black text-muted-foreground uppercase tracking-widest">
                  <th className="px-8 py-6">{t('الموظف المعني')}</th>
                  <th className="px-8 py-6">{t('المشروع')}</th> 
                  <th className="px-8 py-6">{t('النوع والبدلات')}</th>
                  <th className="px-8 py-6">{t('الفترة والمدة')}</th>
                  <th className="px-8 py-6">{t('إجمالي البدلات المحسوبة')}</th>
                  <th className="px-8 py-6">{t('الملاحظات التنفيذية')}</th>
                  <th className="px-8 py-6">{t('الحالة')}</th>
                  <th className="px-8 py-6 text-left">{t('التحكم والبدلات')}</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-border/40">
                {filteredMissions.map((m) => {
                  const emp = employees.find(e => e.id === m.employeeId);
                  const type = missionTypes.find(t => t.id === m.missionTypeId);
                  return (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary rounded-none flex items-center justify-center font-black text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
                             {emp?.name?.[0] || 'U'}
                          </div>
                          <div>
                             <p className="font-black text-foreground uppercase tracking-tight">{emp?.name || t('موظف مجهول')}</p>
                             <p className="text-[10px] font-black text-muted-foreground/60 tracking-widest">ID: {emp?.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 font-black uppercase text-primary tracking-widest text-xs">
                        {(() => {
                          const isGen = isGeneralMission(m);
                          const proj = projects.find(p => p.id === m.projectId);
                          if (isGen) {
                            return (
                              <span className="px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold flex items-center gap-1 w-fit">
                                <span>{proj?.name || t('المهام العامة والتكليفات المباشرة')}</span>
                              </span>
                            );
                          }
                          return proj?.name || (
                            <span className="px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                              {t('مأمورية عامة')}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-8 py-6">
                         {(() => {
                           const calc = calculateMissionAllowances(m, missionTypes);
                           return (
                             <div className="space-y-1">
                                <p className="font-black text-foreground text-xs uppercase tracking-widest">{type?.name || m.missionTypeId || t('مأمورية عامة')}</p>
                                <div className="flex flex-wrap gap-1">
                                   {calc.allowances.length > 0 ? calc.allowances.map((a: any, i: number) => (
                                     <span key={i} className="px-2 py-0.5 bg-muted border border-border text-[9px] font-black uppercase text-muted-foreground tracking-tighter">
                                       {a.name}: {formatCurrency(a.amount)}{a.type === 'Daily' || a.type === 'يومي' ? t('/يوم') : ` (${t('مرة واحدة')})`}
                                     </span>
                                   )) : <span className="text-[9px] font-black text-muted-foreground opacity-40 uppercase">{t('بدون بدلات إضافية')}</span>}
                                </div>
                             </div>
                           );
                         })()}
                      </td>
                      <td className="px-8 py-6">
                         {(() => {
                           const calc = calculateMissionAllowances(m, missionTypes);
                           return (
                             <>
                               <div className="flex items-center gap-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/40 p-2 border border-border/60">
                                  <Calendar className="w-4 h-4 text-primary" />
                                  <span>{m.startDate}</span>
                                  <span className="opacity-40">➔</span>
                                  <span>{m.endDate}</span>
                               </div>
                               <div className="mt-1 text-xs font-black text-primary text-right bg-primary/5 px-2.5 py-0.5 border border-primary/10 w-fit">
                                 {`المدة: ${calc.days} ${calc.days === 1 ? t('يوم') : t('أيام')}`}
                               </div>
                             </>
                           );
                         })()}
                      </td>
                      <td className="px-8 py-6">
                        {(() => {
                          const calc = calculateMissionAllowances(m, missionTypes);

                          return (
                            <div className="space-y-1">
                              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 border border-emerald-500/20 block w-fit shadow-xs font-mono">
                                {formatCurrency(calc.totalAmount)}
                              </span>
                              {calc.breakdown.length > 0 ? (
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-muted-foreground max-w-[220px] truncate" title={calc.breakdown.map(b => `${b.name}: ${b.formulaText}`).join(' + ')}>
                                    {calc.breakdown.map(b => `${b.name}: ${formatCurrency(b.subtotal)}`).join(' + ')}
                                  </p>
                                  <span className="text-[9px] text-muted-foreground/70 font-mono block">
                                    {calc.dailyRate > 0 ? `(${formatCurrency(calc.dailyRate)} × ${calc.days} يوم)` : ''}
                                    {calc.dailyRate > 0 && calc.onceTotal > 0 ? ' + ' : ''}
                                    {calc.onceTotal > 0 ? `${formatCurrency(calc.onceTotal)} ثوابت` : ''}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold text-muted-foreground/60">{t('بدون بدلات تلقائية')}</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm text-muted-foreground font-medium max-w-[200px] truncate" title={m.notes}>
                          {m.notes || '-'}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                         <span className={cn(
                           "px-3 py-1 rounded-none text-xs font-black border",
                           m.status === 'Completed' || m.status === 'Executed' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" :
                           m.status === 'Approved' ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
                           m.status === 'Rejected' ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                         )}>
                           {m.status === 'Completed' || m.status === 'Executed' ? t('مكتملة ومُقيّمة') : m.status === 'Approved' ? t('معتمدة') : m.status === 'Rejected' ? t('مرفوضة') : t('قيد الانتظار')}
                         </span>
                         {(() => {
                           const rawEval = m.evaluation;
                           const evalData = rawEval ? (typeof rawEval === 'string' ? JSON.parse(rawEval) : rawEval) : null;
                           if (!evalData) return null;
                           return (
                             <div className="mt-1.5 flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20 w-fit">
                               ⭐ التقييم: {evalData.finalScore}% ({evalData.ratingGrade || ''})
                             </div>
                           );
                         })()}
                      </td>
                      <td className="px-8 py-6">
                         <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setViewingDetailsMission(m)}
                              className="p-2 bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors border border-blue-500/20 cursor-pointer"
                              title="عرض تفاصيل المأمورية وتقييم المدير"
                            >
                              <Eye className="w-5 h-5" />
                            </button>

                            {(m.status === 'Approved' || m.status === 'Completed' || m.status === 'Executed') && (canEdit('missions') || isAdmin || isHR) && (
                              <button
                                onClick={() => setEvaluatingMission(m)}
                                className="px-2.5 py-2 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors border border-emerald-500/20 text-xs font-black flex items-center gap-1 cursor-pointer"
                                title="تقييم المأمورية"
                              >
                                <Award className="w-4 h-4" />
                                <span>{m.status === 'Completed' ? 'تعديل التقييم' : 'تقييم'}</span>
                              </button>
                            )}

                            {m.status === 'Pending' && canEdit('missions') && (
                              <>
                                <button 
                                  onClick={() => handleUpdateStatus(m.id, 'Approved')}
                                  className="p-2 bg-emerald-500/10 text-emerald-500 rounded-none hover:bg-emerald-500 group-hover:text-white transition-colors border border-emerald-500/20"
                                  title={t('اعتماد')}
                                >
                                  <CheckCircle2 className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={() => handleUpdateStatus(m.id, 'Rejected')}
                                  className="p-2 bg-destructive/10 text-destructive rounded-none hover:bg-destructive group-hover:text-white transition-colors border border-destructive/20"
                                  title={t('رفض')}
                                >
                                  <XCircle className="w-5 h-5" />
                                </button>
                              </>
                            )}
                            {canEdit('missions') && (
                              <button 
                                onClick={() => handleEditMission(m)}
                                className="px-3 py-2 bg-primary/10 text-primary rounded-none hover:bg-primary hover:text-primary-foreground transition-all border border-primary/20 font-black text-xs flex items-center gap-1.5 shadow-sm active:scale-95 group"
                                title={t('تعديل بدلات المأمورية والربط بالمشروع')}
                              >
                                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:text-current" />
                                <span>{t('تعديل البدلات')}</span>
                              </button>
                            )}
                            {canDelete('missions') && (
                              <button 
                                onClick={() => handleDeleteMission(m.id)}
                                className="p-2 bg-muted text-muted-foreground rounded-none hover:bg-destructive hover:text-destructive-foreground transition-colors border border-border"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                            {!canEdit('missions') && !canDelete('missions') && (
                              <span className="text-xs text-muted-foreground italic font-bold">{t('لا يوجد صلاحيات')}</span>
                            )}
                         </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'types' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <AnimatePresence>
            {missionTypes.map((type) => (
              <motion.div 
                layout
                key={type.id}
                className="bg-card p-8 rounded-none border border-border relative group shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-primary/10 rounded-none flex items-center justify-center text-primary">
                     <DollarSign className="w-7 h-7" />
                  </div>
                  <div className="flex gap-2">
                    {canEdit('missions') && (
                      <button 
                        onClick={() => handleEditType(type)}
                        className="p-2 text-primary hover:text-primary-foreground hover:bg-primary rounded-none transition-all border border-transparent hover:border-primary/20"
                        title={t('تعديل البدلات والربط')}
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                    )}
                    {canDelete('missions') && (
                      <button 
                        onClick={() => handleDeleteType(type.id)}
                        className="p-2 text-destructive hover:text-destructive-foreground hover:bg-destructive rounded-none transition-all border border-transparent hover:border-destructive/20"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="text-xl font-black text-foreground mb-4">{type.name}</h3>
                <div className="p-4 bg-muted/30 rounded-none space-y-2 border border-border">
                   <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-widest">{t('البدلات المعرفة')}</p>
                   {(() => {
                      const rawAllowances = type.allowances;
                      const allowances = Array.isArray(rawAllowances) 
                        ? rawAllowances 
                        : (typeof rawAllowances === 'string' ? JSON.parse(rawAllowances) : []);
                      
                      if (allowances.length > 0) {
                        return (
                          <div className="space-y-2">
                            {allowances.map((a: any, i: number) => (
                              <div key={i} className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-medium">{a.name}</span>
                                <span className="text-primary font-black">{formatCurrency(a.amount)}{a.type === 'Daily' ? t('/يوم') : ''}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return <p className="text-sm text-muted-foreground italic">{t('لا توجد بدلات معرفة')}</p>;
                   })()}
                </div>
                {/* Linked Projects */}
                {Array.isArray(type.projectIds) && type.projectIds.length > 0 && (
                  <div className="mt-4 p-3 bg-primary/5 rounded-none border border-primary/10 text-right" dir="rtl">
                    <p className="text-[10px] font-black text-primary mb-1.5 uppercase tracking-widest leading-none">{t('المشاريع المرتبطة:')}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {type.projectIds.map(pId => {
                        const proj = projects.find(p => p.id === pId);
                        return proj ? (
                          <span key={pId} className="px-2.5 py-0.5 bg-card border border-border text-[9px] font-black uppercase text-foreground">
                            {proj.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            <button 
              onClick={() => setIsTypeModalOpen(true)}
              className="border-2 border-dashed border-border rounded-none flex flex-col items-center justify-center py-12 gap-4 text-muted-foreground hover:border-primary hover:text-primary transition-all group p-8 bg-card"
            >
              <div className="w-16 h-16 bg-muted rounded-none flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                 <Plus className="w-8 h-8" />
              </div>
              <p className="font-black">{t('إضافة نوع مأمورية جديد')}</p>
            </button>
           </AnimatePresence>
        </div>
      )}

      {/* Mission Modal */}
      <AnimatePresence>
        {isMissionModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleCloseMissionModal} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card w-full max-w-md rounded-none shadow-2xl overflow-hidden border border-border">
              <div className="p-8 border-b border-border bg-muted/30">
                <h3 className="text-2xl font-black text-foreground">
                  {editingMission ? t(t('تعديل بيانات المأمورية')) : t(t('تسجيل مأمورية جديدة'))}
                </h3>
              </div>
              <form onSubmit={handleAddMission} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('الموظف')}</label>
                    <select
                      required
                      disabled={!isAdmin && !isHR}
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary text-foreground disabled:opacity-80 disabled:cursor-not-allowed"
                      value={missionForm.employeeId || ((!isAdmin && !isHR && currentEmployee?.id) ? currentEmployee.id : '')}
                      onChange={(e) => setMissionForm({ ...missionForm, employeeId: e.target.value })}
                    >
                      <option value="">{t('اختر الموظف...')}</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id} className="bg-card">{e.name} ({e.employeeId})</option>
                      ))}
                    </select>
                  </div>
                  {!missionForm.projectId ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold space-y-1">
                      <div className="flex items-center gap-2 font-black">
                        <Briefcase className="w-4 h-4 text-amber-500" />
                        <span>{t('مأمورية عامة (تكليف مباشر)')}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        {t('هذه المأمورية غير مرتبطة بمشروع. يمكنك تحديد بدلات مخصصة فريدة لها أدناه، أو ربطها بمشروع واستخدام مصفوفة تكاليفه.')}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-primary/10 border border-primary/20 text-primary text-xs font-bold space-y-1">
                      <div className="flex items-center gap-2 font-black">
                        <Briefcase className="w-4 h-4 text-primary" />
                        <span>{t('مأمورية مرتبطة بمشروع')}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        {t('تم استيراد بدلات هذا المشروع تلقائياً، ويمكنك تخصيص المبالغ والبدلات أدناه حسب الحاجة.')}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('المشروع المرتبط')}</label>
                    <select
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary text-foreground"
                      value={missionForm.projectId || ''}
                      onChange={(e) => {
                        const projId = e.target.value;
                        const linkedType = missionTypes.find(t => {
                          const pIds = t.projectIds;
                          return Array.isArray(pIds) && pIds.includes(projId);
                        });

                        if (linkedType) {
                          const rawAllowances = linkedType.allowances;
                          const allowances = Array.isArray(rawAllowances) 
                            ? rawAllowances 
                            : (typeof rawAllowances === 'string' ? JSON.parse(rawAllowances) : []);
                          
                          setMissionForm({ 
                            ...missionForm, 
                            projectId: projId,
                            missionTypeId: linkedType.id,
                            allowances: Array.isArray(allowances) ? allowances.map((a: any) => ({ ...a })) : []
                          });
                        } else {
                          setMissionForm({ 
                            ...missionForm, 
                            projectId: projId 
                          });
                        }
                      }}
                    >
                      <option value="">{t('مأمورية عامة (غير مرتبطة بمشروع)')}</option>
                      {(projects || []).map(p => (
                        <option key={p.id} value={p.id} className="bg-card">{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('نوع المأمورية')}</label>
                    <select
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary text-foreground"
                      value={missionForm.missionTypeId || ''}
                      onChange={(e) => {
                        const selectedType = missionTypes.find(t => t.id === e.target.value);
                        const rawAllowances = selectedType?.allowances;
                        const allowances = Array.isArray(rawAllowances) 
                          ? rawAllowances 
                          : (typeof rawAllowances === 'string' ? JSON.parse(rawAllowances) : []);
                        
                        setMissionForm({ 
                          ...missionForm, 
                          missionTypeId: e.target.value,
                          allowances: allowances.length > 0 ? allowances.map((a: any) => ({ ...a })) : missionForm.allowances
                        });
                      }}
                    >
                      <option value="">{t('اختر نوع المأمورية / مأمورية عامة...')}</option>
                      {(missionTypes || []).map(mType => {
                        const rawAllowances = mType.allowances;
                        const allowances = Array.isArray(rawAllowances) 
                          ? rawAllowances 
                          : (typeof rawAllowances === 'string' ? JSON.parse(rawAllowances) : []);
                        return (
                          <option key={mType.id} value={mType.id} className="bg-card">
                            {mType.name} (
                              {Array.isArray(allowances) && allowances.length > 0 ? allowances.map((a: any) => `${a.name}: ${a.amount}`).join(' + ') : t('بدون بدلات تلقائية')}
                            )
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Dynamic Mission Allowances and Expenses for HR */}
                  <div className="space-y-4 p-4 bg-primary/5 rounded-none border border-primary/20">
                    <div className="flex justify-between items-center">
                      <div>
                        <label className="text-sm font-black text-primary leading-none">{t('التكاليف والبدلات المستحقة للمأمورية')}</label>
                        <p className="text-[10px] text-muted-foreground font-medium mt-1">{t('يمكن للـ HR إضافة التكاليف والبدلات المخصصة بعد موافقة المدير المباشر أو للمأموريات المباشرة.')}</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setMissionForm({
                          ...missionForm,
                          allowances: [...missionForm.allowances, { id: crypto.randomUUID(), name: '', amount: 0, type: 'Daily' }]
                        })}
                        className="text-xs font-black text-primary flex items-center gap-1 hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 border border-primary/20"
                      >
                        <Plus className="w-3.5 h-3.5" />{t('إضافة بدل / تكلفة')}</button>
                    </div>
                      <div className="space-y-3">
                        {Array.isArray(missionForm.allowances) && missionForm.allowances.map((allowance, idx) => (
                          <div key={allowance.id} className="grid grid-cols-12 gap-2 items-end bg-card p-2 rounded-none shadow-sm border border-border">
                            <div className="col-span-4">
                              <label className="text-[10px] font-bold text-muted-foreground block mb-1">{t('الاسم')}</label>
                              <input 
                                required
                                className="w-full px-2 py-1.5 bg-muted/30 border border-border rounded-none text-xs outline-none focus:ring-1 focus:ring-primary text-foreground"
                                value={allowance.name}
                                onChange={(e) => {
                                  const newAllowances = [...missionForm.allowances];
                                  newAllowances[idx].name = e.target.value;
                                  setMissionForm({ ...missionForm, allowances: newAllowances });
                                }}
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="text-[10px] font-bold text-muted-foreground block mb-1">{t('المبلغ')}</label>
                              <input 
                                type="number"
                                required
                                className="w-full px-2 py-1.5 bg-muted/30 border border-border rounded-none text-xs outline-none focus:ring-1 focus:ring-primary text-foreground"
                                value={allowance.amount || 0}
                                onChange={(e) => {
                                  const newAllowances = [...missionForm.allowances];
                                  newAllowances[idx].amount = parseFloat(e.target.value) || 0;
                                  setMissionForm({ ...missionForm, allowances: newAllowances });
                                }}
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="text-[10px] font-bold text-muted-foreground block mb-1">{t('التكرار')}</label>
                              <select 
                                className="w-full px-2 py-1.5 bg-muted/30 border border-border rounded-none text-xs outline-none focus:ring-1 focus:ring-primary text-foreground"
                                value={allowance.type || 'Daily'}
                                onChange={(e) => {
                                  const newAllowances = [...missionForm.allowances];
                                  newAllowances[idx].type = e.target.value as any;
                                  setMissionForm({ ...missionForm, allowances: newAllowances });
                                }}
                              >
                                <option value="Daily" className="bg-card">{t('يومي')}</option>
                                <option value="Once" className="bg-card">{t('مرة واحدة')}</option>
                              </select>
                            </div>
                            <div className="col-span-2 flex justify-end">
                              <button 
                                type="button"
                                onClick={() => {
                                  const newAllowances = missionForm.allowances.filter((_, i) => i !== idx);
                                  setMissionForm({ ...missionForm, allowances: newAllowances });
                                }}
                                className="p-2 text-destructive hover:text-destructive-foreground transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-sm font-bold text-muted-foreground mr-2">{t('من تاريخ')}</label>
                      <input 
                        type="date"
                        required
                        className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary text-foreground"
                        value={missionForm.startDate}
                        onChange={(e) => setMissionForm({ ...missionForm, startDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-muted-foreground mr-2">{t('إلى تاريخ')}</label>
                      <input 
                        type="date"
                        required
                        className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary text-foreground"
                        value={missionForm.endDate}
                        onChange={(e) => setMissionForm({ ...missionForm, endDate: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Live Auto-Calculated Mission Payout & Breakdown Box */}
                  {(() => {
                    let days = 1;
                    if (missionForm.startDate && missionForm.endDate) {
                      const s = new Date(missionForm.startDate);
                      const e = new Date(missionForm.endDate);
                      const diffTime = e.getTime() - s.getTime();
                      days = diffTime < 0 ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                    }

                    let totalPayout = 0;
                    const items = Array.isArray(missionForm.allowances) ? missionForm.allowances.map((a) => {
                      const amt = Number(a.amount) || 0;
                      const isDaily = a.type === 'Daily' || (a.type as string) === 'يومي';
                      const lineTotal = isDaily ? amt * days : amt;
                      totalPayout += lineTotal;
                      return {
                        name: a.name || t('بدل بدون اسم'),
                        amt,
                        isDaily,
                        lineTotal
                      };
                    }) : [];

                    return (
                      <div className="p-4 bg-muted/40 border-2 border-primary/30 rounded-none space-y-3">
                        <div className="flex justify-between items-center text-xs font-black">
                          <span className="text-muted-foreground">{t('مدة المأمورية المحتسبة:')}</span>
                          <span className="text-primary bg-primary/10 px-2.5 py-1 border border-primary/20">{days} {days === 1 ? t('يوم') : t('أيام')}</span>
                        </div>

                        {items.length > 0 && (
                          <div className="space-y-1.5 pt-2 border-t border-border/60">
                            <span className="text-[11px] font-black text-muted-foreground block">{t('تفاصيل التكاليف والبدلات التلقائية:')}</span>
                            {items.map((item, i) => (
                              <div key={i} className="flex justify-between items-center text-xs text-foreground bg-card p-2 border border-border">
                                <span>{item.name} {item.isDaily ? `(${formatCurrency(item.amt)} × ${days} ${t('يوم')})` : `(${t('مرة واحدة')})`}</span>
                                <span className="font-bold text-primary">{formatCurrency(item.lineTotal)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-between items-center text-sm font-black pt-2 border-t-2 border-primary/30">
                          <span className="text-foreground">{t('إجمالي المستحق المالي للمأمورية:')}</span>
                          <span className="text-emerald-600 dark:text-emerald-400 text-base">{formatCurrency(totalPayout)}</span>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('ملاحظات')}</label>
                    <textarea 
                      placeholder={t('وصف المأمورية أو الموقع...')}
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary resize-none h-24 text-foreground"
                      value={missionForm.notes}
                      onChange={(e) => setMissionForm({ ...missionForm, notes: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-none transition-all shadow-lg shadow-primary/20">
                    {editingMission ? t(t('حفظ التعديلات')) : t(t('حفظ المأمورية'))}
                  </button>
                  <button type="button" onClick={handleCloseMissionModal} className="flex-1 py-4 bg-muted text-muted-foreground font-black rounded-none">{t('إلغاء')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Type Modal */}
      <AnimatePresence>
        {isTypeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleCloseTypeModal} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card w-full max-w-md rounded-none shadow-2xl overflow-hidden border border-border">
              <div className="p-8 border-b border-border bg-muted/30">
                <h3 className="text-2xl font-black text-foreground">
                  {editingType ? t(t('تعديل مصفوفة التكاليف')) : t(t('إضافة نوع مأمورية'))}
                </h3>
              </div>
              <form onSubmit={handleAddType} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('اسم النوع')}</label>
                    <input 
                      required
                      placeholder={t('مثال: مأمورية خارجية، مأمورية داخلية')}
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary text-foreground"
                      value={typeForm.name}
                      onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                    />
                  </div>

                  {/* Projects Linkage Checklist */}
                  <div className="space-y-2 text-right">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('المشاريع المرتبطة')}</label>
                    <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto bg-muted/20 p-3 border border-border">
                      {projects.map(p => {
                        const isChecked = typeForm.projectIds?.includes(p.id) || false;
                        return (
                          <label key={p.id} className="flex items-center gap-2 text-xs font-bold text-foreground cursor-pointer select-none">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                let nextIds = [...(typeForm.projectIds || [])];
                                if (e.target.checked) {
                                  nextIds.push(p.id);
                                } else {
                                  nextIds = nextIds.filter(id => id !== p.id);
                                }
                                setTypeForm({ ...typeForm, projectIds: nextIds });
                              }}
                              className="w-4 h-4 rounded-none border-border text-primary focus:ring-primary cursor-pointer"
                            />
                            <span>{p.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Dynamic Allowance Definitions for Mission Type */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-bold text-muted-foreground mr-2">{t('البدلات الافتراضية')}</label>
                      <button 
                        type="button"
                        onClick={() => setTypeForm({
                          ...typeForm,
                          allowances: [...typeForm.allowances, { id: crypto.randomUUID(), name: '', amount: 0, type: 'Daily' }]
                        })}
                        className="text-xs font-black text-primary flex items-center gap-1 hover:text-primary/80 transition-colors"
                      >
                        <Plus className="w-3 h-3" />{t('إضافة بدل')}</button>
                    </div>
                    <div className="space-y-3">
                       {Array.isArray(typeForm.allowances) && typeForm.allowances.map((allowance, idx) => (
                         <div key={allowance.id} className="flex gap-2 items-center bg-muted/30 p-3 rounded-none border border-border">
                           <input 
                             placeholder={t('الاسم')}
                             className="flex-1 px-3 py-2 bg-card border border-border rounded-none text-sm outline-none focus:ring-1 focus:ring-primary text-foreground"
                             value={allowance.name}
                             onChange={(e) => {
                               const newAllowances = [...typeForm.allowances];
                               newAllowances[idx].name = e.target.value;
                               setTypeForm({ ...typeForm, allowances: newAllowances });
                             }}
                           />
                           <input 
                             type="number"
                             placeholder={t('المبلغ')}
                             className="w-24 px-3 py-2 bg-card border border-border rounded-none text-sm outline-none focus:ring-1 focus:ring-primary text-foreground"
                             value={allowance.amount || 0}
                             onChange={(e) => {
                               const newAllowances = [...typeForm.allowances];
                               newAllowances[idx].amount = parseFloat(e.target.value) || 0;
                               setTypeForm({ ...typeForm, allowances: newAllowances });
                             }}
                           />
                           <select 
                             className="w-24 px-3 py-2 bg-card border border-border rounded-none text-sm outline-none focus:ring-1 focus:ring-primary text-foreground"
                             value={allowance.type || ''}
                             onChange={(e) => {
                               const newAllowances = [...typeForm.allowances];
                               newAllowances[idx].type = e.target.value as any;
                               setTypeForm({ ...typeForm, allowances: newAllowances });
                             }}
                           >
                             <option value="Daily" className="bg-card">{t('يومي')}</option>
                             <option value="Once" className="bg-card">{t('مرة واحدة')}</option>
                           </select>
                           <button 
                             type="button"
                             onClick={() => {
                               const newAllowances = typeForm.allowances.filter((_, i) => i !== idx);
                               setTypeForm({ ...typeForm, allowances: newAllowances });
                             }}
                             className="text-destructive hover:text-destructive-foreground p-2 rounded-none hover:bg-destructive transition-colors"
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-none transition-all shadow-lg shadow-primary/20">{t('حفظ النوع')}</button>
                  <button type="button" onClick={handleCloseTypeModal} className="flex-1 py-4 bg-muted text-muted-foreground font-black rounded-none">{t('إلغاء')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* MISSION DETAILS & MANAGER EVALUATION MODAL */}
      <AnimatePresence>
        {viewingDetailsMission && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border-2 border-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl space-y-0 text-right"
            >
              {/* Modal Header */}
              <div className="bg-primary p-6 text-primary-foreground flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary-foreground/10 rounded-xl">
                    <Plane className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">تفاصيل المأمورية وتقييم المدير</h3>
                    <p className="text-xs opacity-80 font-medium">سجل المأمورية الرسمية والتقييم الإداري للأداء</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewingDetailsMission(null)}
                  className="p-2 hover:bg-primary-foreground/10 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                {(() => {
                  const m = viewingDetailsMission;
                  const emp = employees.find(e => e.id === m.employeeId);
                  const type = missionTypes.find(t => t.id === m.missionTypeId);
                  const proj = projects.find(p => p.id === m.projectId);
                  const rawEval = m.evaluation;
                  const evalData = rawEval ? (typeof rawEval === 'string' ? JSON.parse(rawEval) : rawEval) : null;
                  const rawAllowances = m.allowances;
                  const allowances = Array.isArray(rawAllowances) 
                    ? rawAllowances 
                    : (typeof rawAllowances === 'string' ? JSON.parse(rawAllowances) : []);

                  const start = new Date(m.startDate);
                  const end = new Date(m.endDate);
                  const diffTime = end.getTime() - start.getTime();
                  const diffDays = (isNaN(diffTime) || diffTime < 0) ? 1 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                  return (
                    <>
                      {/* Employee & Status Banner */}
                      <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-black text-lg">
                            {emp?.name?.[0] || 'U'}
                          </div>
                          <div>
                            <h4 className="font-black text-base text-foreground">{emp?.name || 'موظف مجهول'}</h4>
                            <p className="text-xs text-muted-foreground font-bold">الرقم الوظيفي: {emp?.employeeId || '-'} | القسم: {(emp as any)?.department || emp?.departmentId || '-'}</p>
                          </div>
                        </div>

                        <span className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-black border",
                          m.status === 'Completed' || m.status === 'Executed' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" :
                          m.status === 'Approved' ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
                          m.status === 'Rejected' ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                        )}>
                          {m.status === 'Completed' || m.status === 'Executed' ? 'مكتملة ومُقيّمة' : m.status === 'Approved' ? 'معتمدة' : m.status === 'Rejected' ? 'مرفوضة' : 'قيد الانتظار'}
                        </span>
                      </div>

                      {/* Mission Info Grid */}
                      <div className="grid grid-cols-2 gap-4 text-xs font-bold">
                        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
                          <span className="text-muted-foreground block text-[10px]">نوع المأمورية (مصفوفة التكاليف):</span>
                          <span className="text-foreground font-black text-sm">{type?.name || 'مأمورية عامة'}</span>
                        </div>
                        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
                          <span className="text-muted-foreground block text-[10px]">المشروع / الجهة:</span>
                          <span className="text-primary font-black text-sm">{proj?.name || 'المهام العامة والتكليفات المباشرة'}</span>
                        </div>
                        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
                          <span className="text-muted-foreground block text-[10px]">تاريخ البدء والانتهاء:</span>
                          <span className="text-foreground font-black">{m.startDate} ➔ {m.endDate}</span>
                        </div>
                        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
                          <span className="text-muted-foreground block text-[10px]">المدة المحتسبة:</span>
                          <span className="text-primary font-mono font-black text-sm">
                            {(() => {
                              const calc = calculateMissionAllowances(m, missionTypes);
                              return `${calc.days} ${calc.days === 1 ? 'يوم' : 'أيام'}`;
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Cost Matrix & Calculated Allowances Breakdown */}
                      {(() => {
                        const calc = calculateMissionAllowances(m, missionTypes);
                        return (
                          <div className="p-4 bg-emerald-500/5 border border-emerald-500/30 rounded-xl space-y-3">
                            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                              <span className="text-xs font-black text-foreground">إجمالي البدلات المحسوبة حسب الأيام ومصفوفة التكاليف:</span>
                              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                {formatCurrency(calc.totalAmount)}
                              </span>
                            </div>

                            {calc.breakdown.length > 0 ? (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground block">تفاصيل حساب بنود البدلات:</span>
                                {calc.breakdown.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-card p-2 rounded-lg border border-border text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-foreground">{item.name}</span>
                                      <span className="text-[10px] px-2 py-0.5 bg-muted text-muted-foreground font-semibold rounded">
                                        {item.type === 'Daily' ? `يومي (${formatCurrency(item.amount)}/يوم)` : 'مرة واحدة'}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[11px] text-muted-foreground font-mono">{item.formulaText}</span>
                                      <span className="font-mono font-black text-emerald-600">{formatCurrency(item.subtotal)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">لا توجد بدلات مخصصة أو مسجلة لهذه المأمورية بمصفوفة التكاليف.</p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Notes / Objectives */}
                      {m.notes && (
                        <div className="space-y-1">
                          <label className="text-xs font-black text-foreground">بيان المأمورية والملاحظات:</label>
                          <div className="p-3 bg-muted/30 border border-border rounded-xl text-xs text-muted-foreground font-medium leading-relaxed">
                            {m.notes}
                          </div>
                        </div>
                      )}

                      {/* MANAGER EVALUATION CARD */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Award className="w-5 h-5 text-amber-500" />
                            <h4 className="font-black text-sm text-foreground">تقييم المدير المباشر لأداء المأمورية</h4>
                          </div>

                          {(m.status === 'Approved' || m.status === 'Completed') && (canEdit('missions') || isAdmin || isHR) && (
                            <button
                              onClick={() => {
                                setViewingDetailsMission(null);
                                setEvaluatingMission(m);
                              }}
                              className="px-3 py-1.5 bg-emerald-600 text-white font-black text-xs rounded-xl hover:bg-emerald-700 transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Award className="w-4 h-4" />
                              <span>{evalData ? 'تعديل التقييم' : 'إدخال تقييم جديد'}</span>
                            </button>
                          )}
                        </div>

                        {evalData ? (
                          <div className="bg-emerald-500/5 border-2 border-emerald-500/30 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-black text-emerald-600 uppercase">الدرجة الكلية للتقييم</span>
                                <div className="text-2xl font-black text-emerald-600 font-mono">{evalData.finalScore}%</div>
                              </div>
                              <span className="px-4 py-1.5 bg-emerald-500/20 text-emerald-700 font-black text-sm rounded-full border border-emerald-500/30">
                                ⭐ {evalData.ratingGrade || 'ممتاز'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold text-foreground">
                              <div className="bg-card p-3 rounded-xl border border-border space-y-1">
                                <span className="text-muted-foreground text-[10px] block">الالتزام بالوقت (40%)</span>
                                <span className="font-mono font-black text-blue-600">{evalData.timeAdherence ?? 85}%</span>
                              </div>
                              <div className="bg-card p-3 rounded-xl border border-border space-y-1">
                                <span className="text-muted-foreground text-[10px] block">جودة النتائج (30%)</span>
                                <span className="font-mono font-black text-blue-600">{evalData.qualityResults ?? 85}%</span>
                              </div>
                              <div className="bg-card p-3 rounded-xl border border-border space-y-1">
                                <span className="text-muted-foreground text-[10px] block">السلوك والتعاون (30%)</span>
                                <span className="font-mono font-black text-blue-600">{evalData.conductCooperation ?? 85}%</span>
                              </div>
                            </div>

                            {evalData.notes && (
                              <div className="space-y-1 pt-1">
                                <span className="text-xs font-black text-foreground">ملاحظات ورأي المدير:</span>
                                <p className="text-xs text-muted-foreground bg-card p-3 rounded-xl border border-border">
                                  {evalData.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-card border border-dashed border-border rounded-2xl p-6 text-center text-muted-foreground text-xs font-bold space-y-2">
                            <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                            <p>لم يتم تسجيل تقييم أداء من المدير المباشر لهذه المأمورية حتى الآن.</p>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MISSION EVALUATION MODAL */}
      <MissionEvaluationModal
        isOpen={!!evaluatingMission}
        onClose={() => setEvaluatingMission(null)}
        mission={evaluatingMission as any}
        employeeName={employees.find(e => e.id === evaluatingMission?.employeeId)?.name}
        departmentName={(employees.find(e => e.id === evaluatingMission?.employeeId) as any)?.department || employees.find(e => e.id === evaluatingMission?.employeeId)?.departmentId}
        onSubmitEvaluation={handleSaveEvaluation}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ ...deleteConfirm, show: false })}
        onConfirm={async () => {
          if (deleteConfirm.type === 'mission') await confirmDeleteMission(deleteConfirm.id);
          else if (deleteConfirm.type === 'type') await confirmDeleteType(deleteConfirm.id);
          setDeleteConfirm({ ...deleteConfirm, show: false });
        }}
        title={t('تأكيد الحذف')}
        description={deleteConfirm.type === 'mission' ? t(t('هل أنت متأكد من حذف هذه المأمورية؟')) : t(t('هل أنت متأكد من حذف هذا النوع؟'))}
      />
    </div>
  );
};
