import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Briefcase, 
  Plus, 
  Search, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Trash2,
  FileText,
  MessageSquare,
  Upload,
  User,
  ArrowRight,
  Filter,
  Layers,
  Code,
  Smartphone,
  Globe,
  Monitor,
  Check,
  X,
  Send,
  ExternalLink,
  AtSign,
  ListTodo,
  Paperclip,
  ShieldCheck,
  ChevronDown,
  Lock,
  Plane,
  Edit2,
  Save,
  Folder,
  Calendar,
  Loader2,
  GitFork
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { db, collection, addDoc, deleteDoc, doc, updateDoc, arrayUnion } from '../../api';
import { getAssignedEmployeeName, isOpenTask, getTaskAssignedIds } from '../../lib/taskUtils';
import { Project, ProjectTask, ProjectStatus, TaskStatus, ProjectPhase, WorkflowLog, Employee, SubTask, TaskChatMessage, ProjectVisit } from '../../types';
import { cn } from '../../lib/utils';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ChatInputWithMentions } from '../ChatInputWithMentions';
import { useLanguage } from '../../contexts/LanguageContext';

export const Operations: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { projects, projectTasks, employees, missions, refreshData } = useData();
  const { user, profile } = useAuth();
  const { canEdit } = usePermissions();
  const { 
    can,
    canEditProject, 
    canManageProjectPhases,
    canManageProjectScope,
    canCreateProject,
    canDeleteProject,
    canCreateTask, 
    canEditTask, 
    canDeleteTask, 
    canChangeTaskStatus, 
    canApproveTask, 
    canCloseTask 
  } = usePermissions();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [isProjectChatOpen, setIsProjectChatOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [subTaskTitle, setSubTaskTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [taskParentSearch, setTaskParentSearch] = useState('');

  // Scope editing state
  const [addExistingProjectScopeInput, setAddExistingProjectScopeInput] = useState('');
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null);
  const [editingScopeName, setEditingScopeName] = useState('');
  const [isUpdatingScope, setIsUpdatingScope] = useState(false);

  // Phase editing state
  const [addExistingProjectPhaseInput, setAddExistingProjectPhaseInput] = useState('');
  const [editingPhaseOldName, setEditingPhaseOldName] = useState<string | null>(null);
  const [editingPhaseNewName, setEditingPhaseNewName] = useState('');
  const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
  const [isUpdatingPhases, setIsUpdatingPhases] = useState(false);
  
  const handleFileUpload = async (taskId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const token = localStorage.getItem('auth_token');
    if (!token) {
      alert('الرجاء تسجيل الدخول أولاً للتمكن من رفع الملفات');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploadingFile(true);
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        let errorMsg = t('فشل الرفع');
        if (response.status === 401) {
          errorMsg = t('غير مصرح لك بالوصول، يرجى تسجيل الدخول مرة أخرى');
        } else {
          try { const err = await response.json(); errorMsg = err.error || errorMsg; } catch(e) {}
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();

      const newAttachment = {
        name: file.name,
        url: data.url,
        uploadedBy: profile?.name || user?.displayName || 'User',
        timestamp: new Date().toISOString(),
        source: 'Local',
      };
        
      await updateDoc(doc(db, 'projectTasks', taskId), {
        attachments: arrayUnion(newAttachment),
        updatedAt: new Date().toISOString()
      });
      await refreshData();
        
      setUploadingFile(false);
    } catch (error: any) {
      console.error('Upload Error:', error);
      alert('حدث خطأ أثناء الرفع: \n\n' + error.message + '\n\nاسم الملف: ' + file.name + '\nنوع الملف: ' + file.type);
      setUploadingFile(false);
    } finally {
      e.target.value = '';
    }
  };

  const handleAddLinkAttachment = async (taskId: string) => {
    const url = prompt('أدخل رابط الملف الخارجي:');
    if (!url) return;
    const name = prompt('أدخل اسم الملف:') || 'مرفق خارجي';

    const newAttachment = {
      name,
      url,
      uploadedBy: profile?.name || user?.displayName || 'User',
      timestamp: new Date().toISOString(),
      source: 'ExternalLink',
    };

    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        attachments: arrayUnion(newAttachment),
        updatedAt: new Date().toISOString()
      });
      await refreshData();
    } catch (error: any) {
      console.error('Add Link Error:', error);
      alert('حدث خطأ أثناء إضافة الرابط: ' + error.message);
    }
  };

  const [projectForm, setProjectForm] = useState<Partial<Project>>({
    name: '',
    parentProjectId: '',
    clientName: '',
    description: '',
    details: '',
    projectManagerId: '',
    teamLeaderId: '',
    consultantTlId: '',
    developerTlId: '',
    phases: ['Analysis', 'Design', 'Development'],
    scope: [],
    visitFollowUps: [],
    status: 'Active',
    startDate: '',
    endDate: ''
  });

  const [taskForm, setTaskForm] = useState<Partial<ProjectTask>>({
    title: '',
    description: '',
    phase: '',
    subPhase: 'General',
    status: 'Pending',
    assignedToId: '',
    startDate: '',
    endDate: '',
    estimatedHours: 0,
    parentTaskId: undefined
  });

  const [newPhaseInput, setNewPhaseInput] = useState('');
  const [newScopeInput, setNewScopeInput] = useState('');
  const [activeProjectTab, setActiveProjectTab] = useState<'details' | 'scope' | 'visits'>('details');
  const [activeProjectModalTab, setActiveProjectModalTab] = useState<'info' | 'scope'>('info');

  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId), 
  [projects, selectedProjectId]);

  const [savingVisitDate, setSavingVisitDate] = useState<string | null>(null);

  const isApprovedOrCompletedMission = useCallback((status: string) => {
    if (!status) return false;
    const s = String(status).toLowerCase().trim();
    return (
      s === 'approved' ||
      s === 'completed' ||
      s === 'executed' ||
      s === 'done' ||
      s === 'approved by hr' ||
      s === 'approved by manager' ||
      s === 'معتمد' ||
      s === 'معتمدة' ||
      s === 'مكتمل' ||
      s === 'مكتملة' ||
      s.includes('approved') ||
      s.includes('completed')
    );
  }, []);

  const projectVisits = useMemo(() => {
    if (!selectedProjectId || !selectedProject) return [];
    
    const pIdLower = String(selectedProjectId).trim().toLowerCase();
    const pNameLower = selectedProject.name ? selectedProject.name.trim().toLowerCase() : '';

    // Group missions by date for this project
    const projectMissions = missions.filter(m => {
      if (!isApprovedOrCompletedMission(m.status)) return false;
      const mProjId = String(m.projectId || '').trim().toLowerCase();
      if (mProjId && mProjId === pIdLower) return true;
      if (pNameLower) {
        const dest = String(m.destination || '').toLowerCase();
        const reason = String(m.reason || '').toLowerCase();
        if (dest.includes(pNameLower) || reason.includes(pNameLower)) return true;
      }
      return false;
    });

    const visitsByDate: { 
      [date: string]: { 
        employeeIds: string[]; 
        reasons: string[]; 
        destinations: string[];
        missionStatuses: string[];
      } 
    } = {};
    
    projectMissions.forEach(m => {
      const empId = m.employeeId ? String(m.employeeId).trim() : '';
      const startStr = m.startDate ? String(m.startDate).split('T')[0] : '';
      const endStr = m.endDate ? String(m.endDate).split('T')[0] : startStr;
      
      if (!startStr) return;

      const [sy, sm, sd] = startStr.split('-').map(Number);
      const [ey, em, ed] = endStr ? endStr.split('-').map(Number) : [sy, sm, sd];

      const start = new Date(sy, sm - 1, sd, 12, 0, 0);
      const end = new Date(ey || sy, (em ? em - 1 : sm - 1), ed || sd, 12, 0, 0);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        if (!visitsByDate[dateStr]) {
          visitsByDate[dateStr] = {
            employeeIds: [],
            reasons: [],
            destinations: [],
            missionStatuses: []
          };
        }
        if (empId && !visitsByDate[dateStr].employeeIds.includes(empId)) {
          visitsByDate[dateStr].employeeIds.push(empId);
        }
        if (m.reason && !visitsByDate[dateStr].reasons.includes(m.reason)) {
          visitsByDate[dateStr].reasons.push(m.reason);
        }
        if (m.destination && !visitsByDate[dateStr].destinations.includes(m.destination)) {
          visitsByDate[dateStr].destinations.push(m.destination);
        }
        if (m.status && !visitsByDate[dateStr].missionStatuses.includes(m.status)) {
          visitsByDate[dateStr].missionStatuses.push(m.status);
        }
      }
    });

    // Also include any manual visitFollowUps that were recorded directly on the project
    const followUpsMap = new Map<string, ProjectVisit>();
    (selectedProject.visitFollowUps || []).forEach(vf => {
      if (vf.date) {
        followUpsMap.set(vf.date, vf);
      }
    });

    const allDates = Array.from(new Set([...Object.keys(visitsByDate), ...Array.from(followUpsMap.keys())])).sort().reverse();

    return allDates.map(date => {
      const followUp = followUpsMap.get(date);
      const missionData = visitsByDate[date] || { employeeIds: [], reasons: [], destinations: [], missionStatuses: [] };
      
      const combinedEmployeeIds = Array.from(new Set([
        ...(followUp?.employeeIds || []),
        ...missionData.employeeIds
      ]));

      // Format date in Arabic for professional title
      let formattedArabicDate = date;
      try {
        const [y, m, d] = date.split('-').map(Number);
        const dt = new Date(y, m - 1, d, 12, 0, 0);
        formattedArabicDate = dt.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      } catch (e) {}

      return {
        id: followUp?.id || `visit-${date}`,
        date,
        formattedArabicDate,
        title: followUp?.title || `زيارة ميدانية - ${formattedArabicDate}`,
        employeeIds: combinedEmployeeIds,
        reasons: missionData.reasons,
        destinations: missionData.destinations,
        meetingMinutes: followUp?.meetingMinutes || '',
        attachmentUrl: followUp?.attachmentUrl || '',
        missionStatuses: missionData.missionStatuses
      };
    });
  }, [missions, selectedProjectId, selectedProject, isApprovedOrCompletedMission]);

  const handleUpdateVisitFollowUp = async (updatedVisit: any) => {
    if (!selectedProject) return;
    setSavingVisitDate(updatedVisit.date);
    try {
      const currentList: ProjectVisit[] = selectedProject.visitFollowUps ? [...selectedProject.visitFollowUps] : [];
      const idx = currentList.findIndex(v => v.date === updatedVisit.date || v.id === updatedVisit.id);
      
      const visitData: ProjectVisit = {
        id: updatedVisit.id || `visit-${updatedVisit.date}`,
        date: updatedVisit.date,
        title: updatedVisit.title || `زيارة ميدانية - ${updatedVisit.date}`,
        employeeIds: updatedVisit.employeeIds || [],
        meetingMinutes: updatedVisit.meetingMinutes || '',
        attachmentUrl: updatedVisit.attachmentUrl || ''
      };

      if (idx >= 0) {
        currentList[idx] = visitData;
      } else {
        currentList.push(visitData);
      }

      await updateDoc(doc(db, 'projects', selectedProject.id), {
        visitFollowUps: currentList,
        updatedAt: new Date().toISOString()
      });

      await refreshData();
    } catch (err) {
      console.error('Error updating visit follow up:', err);
    } finally {
      setSavingVisitDate(null);
    }
  };

  const viewingTask = useMemo(() => 
    projectTasks.find(t => t.id === viewingTaskId),
  [projectTasks, viewingTaskId]);

  const isPM = useMemo(() => {
    return canEditProject(selectedProject);
  }, [selectedProject, canEditProject]);

  const canEditPhases = useMemo(() => {
    return canManageProjectPhases(selectedProject);
  }, [selectedProject, canManageProjectPhases]);

  const canEditScope = useMemo(() => {
    return canManageProjectScope(selectedProject);
  }, [selectedProject, canManageProjectScope]);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  const projectSpecificTasks = useMemo(() => {
    return projectTasks.filter(t => t.projectId === selectedProjectId);
  }, [projectTasks, selectedProjectId]);

  const handleAddScopeToProject = async () => {
    if (!canEditScope) {
      alert('عذراً، ليس لديك صلاحية تعديل وإدارة نطاق واسكوب المشروع');
      return;
    }
    if (!selectedProject || !addExistingProjectScopeInput.trim()) return;
    setIsUpdatingScope(true);
    try {
      const newItem = { id: Date.now().toString(), name: addExistingProjectScopeInput.trim() };
      const currentScope = selectedProject.scope || [];
      const updatedScope = [...currentScope, newItem];

      await updateDoc(doc(db, 'projects', selectedProject.id), {
        scope: updatedScope,
        updatedAt: new Date().toISOString()
      });

      // Auto-generate tasks for each phase for the newly added scope item
      if (selectedProject.phases && selectedProject.phases.length > 0) {
        for (const phase of selectedProject.phases) {
          const autoTask: Partial<ProjectTask> = {
            projectId: selectedProject.id,
            title: `${newItem.name} - ${phase}`,
            description: `مهمة تلقائية لنطاق ${newItem.name} في مرحلة ${phase}`,
            phase: phase,
            subPhase: newItem.name,
            status: 'Pending',
            creatorId: user?.uid || (profile as any)?.employeeId || (profile as any)?.id || 'system',
            workflowLog: [{
              fromStatus: 'Pending',
              toStatus: 'Pending',
              userId: user?.uid || 'system',
              userName: profile?.name || 'النظام',
              timestamp: new Date().toISOString(),
              note: `تم إنشاء المهمة تلقائياً بعد إضافة النطاق للمشروع`
            }],
            createdAt: new Date().toISOString()
          };
          try {
            await addDoc(collection(db, 'projectTasks'), autoTask);
          } catch (taskErr) {
            console.warn('Auto task generation notice:', taskErr);
          }
        }
      }

      await refreshData();
      setAddExistingProjectScopeInput('');
    } catch (error) {
      console.error('Error adding scope slice:', error);
    } finally {
      setIsUpdatingScope(false);
    }
  };

  const handleSaveEditedScope = async (scopeId: string) => {
    if (!canEditScope) {
      alert('عذراً، ليس لديك صلاحية تعديل وإدارة نطاق واسكوب المشروع');
      return;
    }
    if (!selectedProject || !editingScopeName.trim()) return;
    setIsUpdatingScope(true);
    try {
      const currentScope = selectedProject.scope || [];
      const updatedScope = currentScope.map((s: any) => 
        s.id === scopeId ? { ...s, name: editingScopeName.trim() } : s
      );

      await updateDoc(doc(db, 'projects', selectedProject.id), {
        scope: updatedScope,
        updatedAt: new Date().toISOString()
      });

      await refreshData();
      setEditingScopeId(null);
      setEditingScopeName('');
    } catch (error) {
      console.error('Error updating scope item:', error);
    } finally {
      setIsUpdatingScope(false);
    }
  };

  const handleDeleteScope = async (scopeId: string) => {
    if (!canEditScope) {
      alert('عذراً، ليس لديك صلاحية تعديل وإدارة نطاق واسكوب المشروع');
      return;
    }
    if (!selectedProject) return;
    if (!window.confirm('هل أنت تأكد من رغبتك في حذف شريحة نطاق العمل هذه من المشروع؟')) return;
    setIsUpdatingScope(true);
    try {
      const currentScope = selectedProject.scope || [];
      const updatedScope = currentScope.filter((s: any) => s.id !== scopeId);

      await updateDoc(doc(db, 'projects', selectedProject.id), {
        scope: updatedScope,
        updatedAt: new Date().toISOString()
      });

      await refreshData();
    } catch (error) {
      console.error('Error deleting scope item:', error);
    } finally {
      setIsUpdatingScope(false);
    }
  };

  const handleAddPhaseToProject = async () => {
    if (!canEditPhases) {
      alert('عذراً، ليس لديك صلاحية تعديل وإدارة مراحل المشروع');
      return;
    }
    if (!selectedProject || !addExistingProjectPhaseInput.trim()) return;
    const newPhase = addExistingProjectPhaseInput.trim();
    const currentPhases = selectedProject.phases || [];
    if (currentPhases.includes(newPhase)) {
      alert('هذه المرحلة موجودة بالفعل في المشروع');
      return;
    }
    setIsUpdatingPhases(true);
    try {
      const updatedPhases = [...currentPhases, newPhase];

      await updateDoc(doc(db, 'projects', selectedProject.id), {
        phases: updatedPhases,
        updatedAt: new Date().toISOString()
      });

      // Auto-generate tasks for each scope item in this new phase if scope exists
      if (selectedProject.scope && selectedProject.scope.length > 0) {
        for (const scopeItem of selectedProject.scope) {
          const autoTask: Partial<ProjectTask> = {
            projectId: selectedProject.id,
            title: `${scopeItem.name} - ${newPhase}`,
            description: `مهمة تلقائية لنطاق ${scopeItem.name} في مرحلة ${newPhase}`,
            phase: newPhase,
            subPhase: scopeItem.name,
            status: 'Pending',
            creatorId: user?.uid || (profile as any)?.employeeId || (profile as any)?.id || 'system',
            workflowLog: [{
              fromStatus: 'Pending',
              toStatus: 'Pending',
              userId: user?.uid || 'system',
              userName: profile?.name || 'النظام',
              timestamp: new Date().toISOString(),
              note: `تم إنشاء المهمة تلقائياً بعد إضافة مرحلة ${newPhase} للمشروع`
            }],
            createdAt: new Date().toISOString()
          };
          try {
            await addDoc(collection(db, 'projectTasks'), autoTask);
          } catch (taskErr) {
            console.warn('Auto task generation notice:', taskErr);
          }
        }
      }

      await refreshData();
      setAddExistingProjectPhaseInput('');
    } catch (error) {
      console.error('Error adding phase to project:', error);
    } finally {
      setIsUpdatingPhases(false);
    }
  };

  const handleSaveEditedPhase = async (oldPhaseName: string) => {
    if (!canEditPhases) {
      alert('عذراً، ليس لديك صلاحية تعديل وإدارة مراحل المشروع');
      return;
    }
    if (!selectedProject || !editingPhaseNewName.trim()) return;
    const newName = editingPhaseNewName.trim();
    if (oldPhaseName === newName) {
      setEditingPhaseOldName(null);
      setEditingPhaseNewName('');
      return;
    }

    setIsUpdatingPhases(true);
    try {
      const currentPhases = selectedProject.phases || [];
      const updatedPhases = currentPhases.map(p => p === oldPhaseName ? newName : p);

      await updateDoc(doc(db, 'projects', selectedProject.id), {
        phases: updatedPhases,
        updatedAt: new Date().toISOString()
      });

      // Update phase name on all existing tasks of this project
      const matchingTasks = projectTasks.filter(t => t.projectId === selectedProject.id && t.phase === oldPhaseName);
      for (const task of matchingTasks) {
        await updateDoc(doc(db, 'projectTasks', task.id), {
          phase: newName,
          updatedAt: new Date().toISOString()
        });
      }

      await refreshData();
      setEditingPhaseOldName(null);
      setEditingPhaseNewName('');
    } catch (error) {
      console.error('Error updating project phase name:', error);
    } finally {
      setIsUpdatingPhases(false);
    }
  };

  const handleDeletePhase = async (phaseName: string) => {
    if (!canEditPhases) {
      alert('عذراً، ليس لديك صلاحية تعديل وإدارة مراحل المشروع');
      return;
    }
    if (!selectedProject) return;
    const matchingTasksCount = projectTasks.filter(t => t.projectId === selectedProject.id && t.phase === phaseName).length;
    
    let confirmMsg = `هل أنت تأكد من رغبتك في حذف مرحلة "${phaseName}" من المشروع؟`;
    if (matchingTasksCount > 0) {
      confirmMsg += `\nملاحظة: تنبيه، يوجد ${matchingTasksCount} مهمة مرتبطة بهذه المرحلة.`;
    }

    if (!window.confirm(confirmMsg)) return;

    setIsUpdatingPhases(true);
    try {
      const currentPhases = selectedProject.phases || [];
      const updatedPhases = currentPhases.filter(p => p !== phaseName);

      await updateDoc(doc(db, 'projects', selectedProject.id), {
        phases: updatedPhases,
        updatedAt: new Date().toISOString()
      });

      await refreshData();
    } catch (error) {
      console.error('Error deleting project phase:', error);
    } finally {
      setIsUpdatingPhases(false);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newProjectData: Partial<Project> = {
        ...projectForm,
        parentProjectId: projectForm.parentProjectId || null,
        projectManagerId: projectForm.projectManagerId || null,
        teamLeaderId: projectForm.teamLeaderId || null,
        consultantTlId: projectForm.consultantTlId || null,
        developerTlId: projectForm.developerTlId || null,
        createdAt: new Date().toISOString()
      };
      
      const projectRef = await addDoc(collection(db, 'projects'), newProjectData);
      
      // Auto-generate tasks for each Phase x Scope segment
      if (projectForm.phases && projectForm.scope && projectForm.scope.length > 0) {
        for (const phase of projectForm.phases) {
          for (const scopeItem of projectForm.scope) {
            const autoTask: Partial<ProjectTask> = {
              projectId: projectRef.id,
              title: `${scopeItem.name} - ${phase}`,
              description: `مهمة تلقائية لنطاق ${scopeItem.name} في مرحلة ${phase}`,
              phase: phase,
              subPhase: scopeItem.name,
              status: 'Pending',
              creatorId: user?.uid,
              workflowLog: [{
                fromStatus: 'Pending',
                toStatus: 'Pending',
                userId: user?.uid || 'system',
                userName: 'System',
                timestamp: new Date().toISOString(),
                note: 'Auto-generated from Project Scope'
              }],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await addDoc(collection(db, 'projectTasks'), autoTask);
          }
        }
      }

      await refreshData();
      setIsProjectModalOpen(false);
      setProjectForm({
        name: '',
        parentProjectId: '',
        clientName: '',
        description: '',
        projectManagerId: '',
        teamLeaderId: '',
        consultantTlId: '',
        developerTlId: '',
        phases: ['Analysis', 'Design', 'Development'],
        scope: [],
        visitFollowUps: [],
        status: 'Active',
        startDate: '',
        endDate: ''
      });
      setActiveProjectModalTab('info');
    } catch (error) {
      console.error('Error adding project:', error);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmittingTask) return;
    setIsSubmittingTask(true);
    try {
      const targetProjectId = selectedProjectId || (taskForm as any).projectId || null;
      const assignedEmp = employees.find(emp => 
        emp.id === taskForm.assignedToId || 
        emp.employeeId === taskForm.assignedToId || 
        emp.userId === taskForm.assignedToId
      );
      
      const allSelectedEmpIds = new Set<string>();
      if (taskForm.assignedToId) allSelectedEmpIds.add(String(taskForm.assignedToId).trim().toLowerCase());
      if (Array.isArray(taskForm.assignedToIds)) {
        taskForm.assignedToIds.forEach(id => {
          if (id) allSelectedEmpIds.add(String(id).trim().toLowerCase());
        });
      }
      if (assignedEmp) {
        if (assignedEmp.id) allSelectedEmpIds.add(String(assignedEmp.id).trim().toLowerCase());
        if (assignedEmp.employeeId) allSelectedEmpIds.add(String(assignedEmp.employeeId).trim().toLowerCase());
        if (assignedEmp.userId) allSelectedEmpIds.add(String(assignedEmp.userId).trim().toLowerCase());
      }
      const assignedToIds = Array.from(allSelectedEmpIds);

      const newTask: any = {
        title: taskForm.title.trim(),
        description: taskForm.description?.trim() || '',
        phase: taskForm.phase || null,
        subPhase: taskForm.subPhase || 'General',
        priority: (taskForm as any).priority || 'Medium',
        projectId: targetProjectId,
        creatorId: user.uid,
        createdBy: profile?.name || user.displayName || 'User',
        assignedBy: user.uid,
        assignedById: user.uid,
        assignedByName: profile?.name || user.displayName || 'User',
        assignedTo: assignedEmp?.name || taskForm.assignedToId || '',
        assignedToId: taskForm.assignedToId || (assignedToIds[0] || null),
        assignedToIds: assignedToIds,
        parentTaskId: taskForm.parentTaskId || null,
        startDate: taskForm.startDate || new Date().toISOString().split('T')[0],
        endDate: taskForm.endDate || '',
        estimatedHours: Number(taskForm.estimatedHours || 0),
        status: 'Pending',
        workflowLog: [{
          fromStatus: 'Pending',
          toStatus: 'Pending',
          userId: user.uid,
          userName: profile?.name || user.displayName || 'User',
          timestamp: new Date().toISOString(),
          note: `Task Created and assigned to ${assignedEmp?.name || taskForm.assignedToId || 'unassigned'}`
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'projectTasks'), newTask);
      await refreshData();
      setIsTaskModalOpen(false);
      setTaskForm({ 
        title: '', 
        description: '', 
        phase: '', 
        subPhase: 'General',
        assignedToId: '',
        assignedToIds: [],
        startDate: '',
        endDate: '',
        estimatedHours: 0,
        parentTaskId: undefined
      });
    } catch (error) {
      console.error('Error adding task:', error);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus, note?: string) => {
    if (!user) return;
    const task = projectTasks.find(t => t.id === taskId);
    if (!task) return;

    // Check dependency: cannot close a task if it has open sub-tasks
    if (newStatus === 'Approved' || newStatus === 'Executed') {
      const childTasks = projectTasks.filter(t => t.parentTaskId === taskId);
      const hasOpenChildren = childTasks.some(child => child.status !== 'Approved' && child.status !== 'Executed' && child.status !== 'Rejected');
      if (hasOpenChildren) {
        alert('لا يمكن إغلاق هذه المهمة أو الموافقة عليها لوجود مهام فرعية (Sub-tasks) بداخلها لم يتم إغلاقها ومراجعتها بعد.');
        return;
      }
    }

    const log: WorkflowLog = {
      fromStatus: task.status,
      toStatus: newStatus,
      userId: user.uid,
      userName: profile?.name || user.displayName || 'User',
      timestamp: new Date().toISOString(),
      note: note || ''
    };

    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        status: newStatus,
        workflowLog: arrayUnion(log),
        updatedAt: new Date().toISOString()
      });
      await refreshData();
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleUpdateProjectStatus = async (projectId: string, newStatus: ProjectStatus) => {
    if (!isPM) {
      alert('عذراً، مدير المشروع فقط هو من يمكنه تغيير حالة المشروع');
      return;
    }
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      await refreshData();
    } catch (error) {
      console.error('Error updating project status:', error);
    }
  };

  const handleUpdateProjectDetails = async (projectId: string, field: string, value: any) => {
    if (!isPM) {
      alert('عذراً، مدير المشروع فقط هو من يمكنه تعديل بيانات المشروع');
      return;
    }
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        [field]: value,
        updatedAt: new Date().toISOString()
      });
      await refreshData();
    } catch (error) {
      console.error('Error updating project details:', error);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      await refreshData();
      setSelectedProjectId(null);
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  const handleAddSubTask = async (taskId: string, title: string) => {
    if (!title.trim()) return;
    const subTask: SubTask = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      title,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        subTasks: arrayUnion(subTask),
        updatedAt: new Date().toISOString()
      });
      await refreshData();
    } catch (error) {
      console.error('Error adding subtask:', error);
      alert('حدث خطأ أثناء إضافة المهمة الفرعية: ' + error);
    }
  };

  const handleToggleSubTask = async (taskId: string, subTaskId: string) => {
    const task = projectTasks.find(t => t.id === taskId);
    if (!task || !task.subTasks) return;
    
    const updatedSubTasks = task.subTasks.map(st => 
      st.id === subTaskId ? { ...st, status: st.status === 'Completed' ? 'Pending' : 'Completed' } : st
    );

    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        subTasks: updatedSubTasks,
        updatedAt: new Date().toISOString()
      });
      await refreshData();
    } catch (error) {
      console.error('Error toggling subtask:', error);
    }
  };

  const handleSendChatMessage = async (targetId: string, type: 'task' | 'project', text: string) => {
    if (!text.trim() || !user) return;
    
    // Simple mention detection
    const mentions = employees
      .filter(e => text.includes(`@${e.name}`))
      .map(e => e.id);

    const message: TaskChatMessage = {
      id: crypto.randomUUID(),
      userId: user.uid,
      userName: profile?.name || user?.displayName || 'User',
      text,
      mentions,
      createdAt: new Date().toISOString()
    };

    try {
      const collectionName = type === 'task' ? 'projectTasks' : 'projects';
      const docRef = doc(db, collectionName, targetId);
      
      // We store chat as an array in the document for simplicity in this version
      // but a sub-collection is strictly preferred for enterprise apps
      await updateDoc(docRef, {
        [type === 'task' ? 'comments' : 'chat']: arrayUnion(message)
      });
      await refreshData();
      setChatMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="space-y-8 pb-32">
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => {
          if (deleteConfirmId) {
            handleDeleteProject(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        title={t('تأكيد حذف المشروع')}
        description={t('هل أنت متأكد من حذف هذا المشروع نهائياً؟ سيتم حذف جميع المهام والمرفقات والمحادثات المرتبطة به. لا يمكن التراجع عن هذا الإجراء.')}
      />
      <div className="flex justify-between items-center bg-card p-8 rounded-[3rem] border border-border shadow-sm">
        <div className="flex items-center gap-6">
          <motion.div 
            className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-indigo-600/20 cursor-pointer select-none"
            whileHover={{ scale: 1.15, rotate: 360, transition: { duration: 0.6, ease: "easeInOut" } }}
            whileTap={{ scale: 0.95 }}
          >
            <Briefcase className="w-8 h-8" />
          </motion.div>
          <div>
            <h1 className="text-4xl font-black text-foreground leading-tight">{t('قسم العمليات')}</h1>
            <p className="text-muted-foreground font-medium text-lg">{t('إدارة مشاريع السوفتوير والمخططات الزمنية وفريق العمل')}</p>
          </div>
        </div>
        {canCreateProject() && (
          <button 
            onClick={() => {
              setProjectForm({
                name: '',
                parentProjectId: '',
                clientName: '',
                description: '',
                details: '',
                projectManagerId: '',
                teamLeaderId: '',
                consultantTlId: '',
                developerTlId: '',
                phases: ['Analysis', 'Design', 'Development'],
                scope: [],
                visitFollowUps: [],
                status: 'Active',
                startDate: '',
                endDate: ''
              });
              setIsProjectModalOpen(true);
            }}
            className="bg-primary text-primary-foreground px-8 py-5 rounded-[1.5rem] font-black shadow-lg shadow-primary/10 hover:bg-primary/90 transition-all flex items-center gap-3 hover:scale-105 active:scale-95"
          >
            <Plus className="w-6 h-6" />{t('فتح مشروع جديد')}</button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Project List Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="relative">
            <Search className="absolute right-6 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input 
              type="text"
              placeholder={t('البحث عن مشروع...')}
              className="w-full pr-14 pl-6 py-5 bg-card border border-border rounded-[2rem] shadow-sm outline-none focus:ring-2 focus:ring-primary font-bold text-foreground placeholder:text-muted-foreground/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
            {filteredProjects.filter(p => !p.parentProjectId).map(parentProj => (
              <div key={parentProj.id} className="space-y-2">
                <button
                  onClick={() => setSelectedProjectId(parentProj.id)}
                  className={cn(
                    "w-full text-right p-6 rounded-[2.5rem] border transition-all relative group",
                    selectedProjectId === parentProj.id 
                      ? "bg-primary border-primary shadow-xl shadow-primary/10" 
                      : "bg-card border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                      selectedProjectId === parentProj.id ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                    )}>
                      <Globe className="w-6 h-6" />
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      selectedProjectId === parentProj.id ? "bg-white/20 text-white" : "bg-emerald-500/10 text-emerald-500"
                    )}>
                      {parentProj.status}
                    </span>
                  </div>
                  <h3 className={cn(
                    "text-xl font-black mb-1",
                    selectedProjectId === parentProj.id ? "text-white" : "text-foreground"
                  )}>{parentProj.name}</h3>
                  <p className={cn(
                    "text-sm font-bold opacity-70 mb-4",
                    selectedProjectId === parentProj.id ? "text-white" : "text-muted-foreground"
                  )}>{parentProj.clientName}</p>
                  
                  {selectedProjectId === parentProj.id && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="absolute left-6 top-1/2 -translate-y-1/2"
                    >
                      <ChevronRight className="w-6 h-6 text-white" />
                    </motion.div>
                  )}
                </button>
                
                {/* Visual rendering of Sub-projects associated with this parent project */}
                {filteredProjects.filter(sub => sub.parentProjectId === parentProj.id).map(subProj => (
                  <button
                    key={subProj.id}
                    onClick={() => setSelectedProjectId(subProj.id)}
                    className={cn(
                      "w-[92%] mr-auto block text-right p-4 rounded-[2rem] border transition-all relative group",
                      selectedProjectId === subProj.id 
                        ? "bg-primary/80 border-primary shadow-xl shadow-primary/10 text-white" 
                        : "bg-muted/50 border-border hover:border-primary/30"
                    )}
                  >
                    <div className="flex justify-between items-center mb-2">
                       <span className={cn(
                         "text-[10px] font-black px-2 py-0.5 rounded-md",
                         selectedProjectId === subProj.id ? "bg-white/20 text-white" : "bg-card text-muted-foreground shadow-sm"
                       )}>{t('مشروع فرعي')}</span>
                       <span className={cn(
                         "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                         selectedProjectId === subProj.id ? "bg-emerald-400/20 text-white" : "bg-emerald-500/10 text-emerald-500"
                       )}>
                         {subProj.status}
                       </span>
                    </div>
                    <h3 className={cn(
                      "text-sm font-black mb-1",
                      selectedProjectId === subProj.id ? "text-white" : "text-foreground"
                    )}>{subProj.name}</h3>
                    {selectedProjectId === subProj.id && (
                      <ChevronRight className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white" />
                    )}
                  </button>
                ))}
              </div>
            ))}
            
            {/* Display orphan subprojects (their parent was deleted or not matching search context) */}
            {filteredProjects.filter(p => p.parentProjectId && !filteredProjects.find(parent => parent.id === p.parentProjectId)).map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={cn(
                  "w-full text-right p-6 rounded-[2.5rem] border border-dashed transition-all relative group",
                  selectedProjectId === p.id 
                    ? "bg-muted border-border shadow-xl" 
                    : "bg-muted/30 border-border hover:border-muted-foreground/30"
                )}
              >
                  <div className="flex justify-between items-start mb-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      selectedProjectId === p.id ? "bg-white/20 text-white" : "bg-muted border border-border text-muted-foreground"
                    )}>
                      {p.status}
                    </span>
                    <span className={cn(
                        "text-xs font-black",
                        selectedProjectId === p.id ? "text-muted-foreground" : "text-muted-foreground/60"
                      )}>{t('مشروع فرعي يتيم')}</span>
                  </div>
                  <h3 className={cn(
                    "text-xl font-black mb-1",
                    selectedProjectId === p.id ? "text-foreground" : "text-foreground/80"
                  )}>{p.name}</h3>
                  <p className={cn(
                    "text-sm font-bold opacity-70 mb-4",
                    selectedProjectId === p.id ? "text-muted-foreground" : "text-muted-foreground/60"
                  )}>{p.clientName}</p>
                </button>
            ))}
          </div>
        </div>

        {/* Project View Content */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {selectedProject ? (
              <motion.div
                key={selectedProject.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {/* Project Header */}
                <div className="bg-card p-10 rounded-[3rem] border border-border shadow-sm relative overflow-hidden text-right" dir="rtl">
                  <div className="absolute top-0 right-0 w-2 h-full bg-primary" />
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <div className="flex items-center gap-2 text-primary font-black text-sm uppercase tracking-widest mb-2">
                        <Layers className="w-4 h-4" />{t('تفاصيل المشروع')}</div>
                      <h2 className="text-4xl font-black text-foreground mb-2">{selectedProject.name}</h2>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground font-bold text-xs mb-4">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full border border-border">
                           <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                           <span className="text-muted-foreground/60">{t('مدير المشروع:')}</span>
                           <span className="text-foreground">{employees.find(e => e.id === selectedProject.projectManagerId)?.name || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full border border-border">
                           <User className="w-3.5 h-3.5 text-primary" />
                           <span className="text-muted-foreground/60">{t('قائد الاستشاري:')}</span>
                           <span className="text-foreground">{employees.find(e => e.id === selectedProject.consultantTlId)?.name || '-'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full border border-border">
                           <Code className="w-3.5 h-3.5 text-primary" />
                           <span className="text-muted-foreground/60">{t('قائد التطوير:')}</span>
                           <span className="text-foreground">{employees.find(e => e.id === selectedProject.teamLeaderId)?.name || '-'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-muted-foreground font-bold">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {selectedProject.clientName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          أُنشئ في {new Date(selectedProject.createdAt).toLocaleDateString('ar-EG')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <button 
                          onClick={() => setIsProjectChatOpen(true)}
                          className="p-4 bg-primary/10 text-primary rounded-2xl hover:bg-primary/20 transition-all flex items-center gap-2 font-black"
                       >
                         <MessageSquare className="w-6 h-6" />{t('محادثة المشروع')}</button>
                       {canDeleteProject(selectedProject) && (
                         <button 
                           onClick={() => setDeleteConfirmId(selectedProject.id)}
                           className="p-4 bg-destructive/10 text-destructive rounded-2xl hover:bg-destructive/20 transition-all hover:scale-105"
                         >
                           <Trash2 className="w-6 h-6" />
                         </button>
                       )}
                    </div>
                  </div>

                  <div className="flex border-b border-border mb-8 overflow-x-auto no-scrollbar gap-8">
                    <button 
                      onClick={() => setActiveProjectTab('details')}
                      className={cn(
                        "pb-4 font-black transition-all border-b-2 text-lg",
                        activeProjectTab === 'details' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >{t('التفاصيل والوصف')}</button>
                    <button 
                      onClick={() => setActiveProjectTab('scope')}
                      className={cn(
                        "pb-4 font-black transition-all border-b-2 text-lg",
                        activeProjectTab === 'scope' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >{t('نطاق المشروع (Scope)')}</button>
                    <button 
                      onClick={() => setActiveProjectTab('visits')}
                      className={cn(
                        "pb-4 font-black transition-all border-b-2 text-lg",
                        activeProjectTab === 'visits' ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >{t('كارت متابعة الزيارات')}</button>
                  </div>

                  <AnimatePresence mode="wait">
                    {activeProjectTab === 'details' && (
                      <motion.div 
                        key="details"
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-8"
                      >
                        <div className="p-8 bg-primary/5 rounded-[2.5rem] border border-primary/10">
                           <div className="flex items-center gap-2 text-sm font-black text-primary mb-4">
                              <FileText className="w-4 h-4"/>{t('وصف وتفاصيل إضافية')}</div>
                           {isPM ? (
                             <textarea 
                                className="w-full bg-transparent p-0 border-none outline-none focus:ring-0 text-foreground font-medium leading-relaxed text-right mb-6 resize-none min-h-[60px] placeholder:text-muted-foreground/40"
                                defaultValue={selectedProject.description || ''}
                                onBlur={(e) => handleUpdateProjectDetails(selectedProject.id, 'description', e.target.value)}
                                placeholder={t('أضف وصفاً للمشروع...')}
                             />
                           ) : (
                             <p className="text-foreground font-medium leading-relaxed text-right mb-6">
                                {selectedProject.description || t('لا يوجد وصف متاح')}
                             </p>
                           )}
                           
                           {isPM ? (
                             <div className="space-y-4">
                                <label className="text-xs font-black text-muted-foreground block">{t('تفاصيل إضافية (للمدراء فقط)')}</label>
                                <textarea 
                                   className="w-full bg-card p-6 rounded-3xl border border-border outline-none focus:ring-2 focus:ring-primary font-medium text-foreground text-right min-h-[120px]"
                                   placeholder={t('أضف تفاصيل إستراتيجية أو تعليمات للمدراء...')}
                                   defaultValue={selectedProject.details}
                                   onBlur={(e) => handleUpdateProjectDetails(selectedProject.id, 'details', e.target.value)}
                                />
                             </div>
                           ) : selectedProject.details && (
                             <div className="p-6 bg-card rounded-3xl border border-border shadow-sm">
                                <p className="text-muted-foreground italic text-sm text-right">{selectedProject.details}</p>
                             </div>
                           )}
                        </div>

                        {/* Linked Missions Section */}
                        <div>
                           <div className="flex items-center justify-between mb-6 px-4">
                              <div className="flex items-center gap-2">
                                 <Plane className="w-5 h-5 text-primary" />
                                 <h3 className="text-xl font-black text-foreground font-sans">{t('المأموريات المرتبطة بالمشروع')}</h3>
                              </div>
                              <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-xs font-black">
                                 {(missions.filter(m => m.projectId === selectedProject.id)).length} مأمورية
                              </span>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {(missions.filter(m => m.projectId === selectedProject.id)).map(mission => {
                                 const emp = employees.find(e => e.id === mission.employeeId);
                                 return (
                                    <div key={mission.id} className="bg-card p-6 rounded-3xl border border-border shadow-sm hover:shadow-md transition-shadow flex items-center gap-4">
                                       <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                                          <User className="w-6 h-6" />
                                       </div>
                                       <div className="flex-1 min-w-0 text-right">
                                          <p className="text-sm font-black text-foreground truncate font-sans">{emp?.name || t('موظف مجهول')}</p>
                                          <p className="text-[10px] font-bold text-muted-foreground font-sans">
                                             {mission.startDate} إلى {mission.endDate}
                                          </p>
                                       </div>
                                    </div>
                                 );
                              })}
                              {(missions.filter(m => m.projectId === selectedProject.id)).length === 0 && (
                                 <p className="col-span-full text-center py-10 text-muted-foreground italic text-sm font-sans bg-muted/30 rounded-3xl border border-dashed border-border">{t('لا توجد مأموريات مربوطة حالياً')}</p>
                              )}
                           </div>
                         </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6 bg-muted/50 rounded-[2rem] border border-border mt-8">
                            <div>
                              <p className="text-[10px] text-muted-foreground font-black mb-1 uppercase tracking-widest">{t('مدير المشروع')}</p>
                              <div className="flex items-center gap-1">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                {isPM ? (
                                  <select 
                                     className="bg-transparent text-foreground font-bold outline-none cursor-pointer p-0 text-sm w-full"
                                     value={selectedProject.projectManagerId || ''}
                                     onChange={(e) => handleUpdateProjectDetails(selectedProject.id, 'projectManagerId', e.target.value)}
                                  >
                                     <option value="" disabled className="bg-card">{t('اختر مديراً...')}</option>
                                     {employees.map(emp => (
                                       <option key={emp.id} value={emp.id} className="bg-card">{emp.name}</option>
                                     ))}
                                  </select>
                                ) : (
                                  <p className="font-bold text-foreground">{employees.find(e => e.id === selectedProject.projectManagerId)?.name || '-'}</p>
                                )}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground font-black mb-1 uppercase tracking-widest">{t('قائد التطوير')}</p>
                              {isPM ? (
                                <select 
                                   className="bg-transparent text-foreground font-bold outline-none cursor-pointer p-0 text-sm w-full"
                                   value={selectedProject.teamLeaderId || ''}
                                   onChange={(e) => handleUpdateProjectDetails(selectedProject.id, 'teamLeaderId', e.target.value)}
                                >
                                   <option value="" disabled className="bg-card">{t('اختر قائداً...')}</option>
                                   {employees.map(emp => (
                                     <option key={emp.id} value={emp.id} className="bg-card">{emp.name}</option>
                                   ))}
                                </select>
                              ) : (
                                <p className="font-bold text-foreground">{employees.find(e => e.id === selectedProject.teamLeaderId)?.name || '-'}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground font-black mb-1 uppercase tracking-widest">{t('قائد الاستشاري')}</p>
                              {isPM ? (
                                <select 
                                   className="bg-transparent text-foreground font-bold outline-none cursor-pointer p-0 text-sm w-full"
                                   value={selectedProject.consultantTlId || ''}
                                   onChange={(e) => handleUpdateProjectDetails(selectedProject.id, 'consultantTlId', e.target.value)}
                                >
                                   <option value="" disabled className="bg-card">{t('اختر قائداً...')}</option>
                                   {employees.map(emp => (
                                     <option key={emp.id} value={emp.id} className="bg-card">{emp.name}</option>
                                   ))}
                                </select>
                              ) : (
                                <p className="font-bold text-foreground">{employees.find(e => e.id === selectedProject.consultantTlId)?.name || '-'}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground font-black mb-1 uppercase tracking-widest">{t('المخطط الزمني')}</p>
                              {isPM ? (
                                <div className="flex items-center gap-1 text-[11px] font-bold text-primary">
                                   <input type="date" className="bg-transparent outline-none cursor-pointer w-20" value={selectedProject.startDate || ''} onChange={(e) => handleUpdateProjectDetails(selectedProject.id, 'startDate', e.target.value)} />
                                   <span>-</span>
                                   <input type="date" className="bg-transparent outline-none cursor-pointer w-20" value={selectedProject.endDate || ''} onChange={(e) => handleUpdateProjectDetails(selectedProject.id, 'endDate', e.target.value)} />
                                </div>
                              ) : (
                                <p className="font-bold text-primary text-[11px]">
                                  {selectedProject.startDate ? new Date(selectedProject.startDate).toLocaleDateString('ar-EG') : t('؟')} - {selectedProject.endDate ? new Date(selectedProject.endDate).toLocaleDateString('ar-EG') : t('؟')}
                                </p>
                              )}
                            </div>
                            <div className="relative group">
                              <p className="text-[10px] text-muted-foreground font-black mb-1 uppercase tracking-widest">{t('الحالة')}</p>
                              {isPM ? (
                                <select 
                                   className="bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black outline-none px-2 py-1 appearance-none cursor-pointer border border-emerald-500/20"
                                   value={selectedProject.status || ''}
                                   onChange={(e) => handleUpdateProjectStatus(selectedProject.id, e.target.value as ProjectStatus)}
                                >
                                   <option value="Active" className="bg-card">Active</option>
                                   <option value="Completed" className="bg-card">Completed</option>
                                   <option value="On Hold" className="bg-card">On Hold</option>
                                </select>
                              ) : (
                                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-black border border-emerald-500/20">{selectedProject.status}</span>
                              )}
                            </div>
                        </div>
                      </motion.div>
                    )}

                    {activeProjectTab === 'scope' && (
                      <motion.div 
                        key="scope"
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                            <div className="flex items-center gap-2">
                              <Layers className="w-6 h-6 text-blue-600" />
                              <h3 className="text-xl font-black text-gray-900">{t('نطاق عمل المشروع (Project Scope)')}</h3>
                            </div>
                            <span className="text-xs font-bold text-muted-foreground bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                              {selectedProject.scope?.length || 0} {t('شرائح نطاق العمل')}
                            </span>
                         </div>

                         {/* Add new scope slice form for project managers */}
                         {canEditScope && (
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/80 space-y-2">
                               <label className="text-xs font-black text-blue-900 block">{t('إضافة شريحة نطاق عمل جديدة للمشروع:')}</label>
                               <div className="flex gap-2">
                                  <input 
                                     type="text" 
                                     value={addExistingProjectScopeInput} 
                                     onChange={(e) => setAddExistingProjectScopeInput(e.target.value)}
                                     placeholder={t('أدخل عنوان النطاق الجديد (مثل: تصميم الهوية، البرمجة الخلفية...)')}
                                     className="flex-1 px-4 py-2.5 bg-card text-foreground border border-border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary"
                                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddScopeToProject(); } }}
                                  />
                                  <button 
                                     type="button" 
                                     onClick={handleAddScopeToProject}
                                     disabled={!addExistingProjectScopeInput.trim() || isUpdatingScope}
                                     className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                                  >
                                     <Plus className="w-4 h-4" />
                                     <span>{t('إضافة وحفظ النطاق')}</span>
                                  </button>
                               </div>
                            </div>
                         )}

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedProject.scope?.map((s: any) => (
                               <div key={s.id} className="bg-card text-foreground p-5 rounded-3xl border border-border shadow-sm flex items-center justify-between gap-4 group hover:border-primary/50 transition-all">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                     <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                                        <Check className="w-5 h-5" />
                                     </div>
                                     
                                     {editingScopeId === s.id ? (
                                        <div className="flex items-center gap-2 flex-1">
                                           <input 
                                              type="text" 
                                              value={editingScopeName} 
                                              onChange={(e) => setEditingScopeName(e.target.value)}
                                              className="w-full px-3 py-1.5 bg-background border border-primary rounded-lg text-xs font-black outline-none"
                                              autoFocus
                                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveEditedScope(s.id); } }}
                                           />
                                           <button 
                                              type="button" 
                                              onClick={() => handleSaveEditedScope(s.id)} 
                                              className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                                              title={t('حفظ')}
                                           >
                                              <Save className="w-4 h-4" />
                                           </button>
                                           <button 
                                              type="button" 
                                              onClick={() => { setEditingScopeId(null); setEditingScopeName(''); }} 
                                              className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                              title={t('إلغاء')}
                                           >
                                              <X className="w-4 h-4" />
                                           </button>
                                        </div>
                                     ) : (
                                        <div className="flex-1 min-w-0">
                                           <p className="font-black text-gray-900 truncate">{s.name}</p>
                                        </div>
                                     )}
                                  </div>

                                  {canEditScope && editingScopeId !== s.id && (
                                     <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                           type="button" 
                                           onClick={() => { setEditingScopeId(s.id); setEditingScopeName(s.name); }} 
                                           className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                           title={t('تعديل النطاق')}
                                        >
                                           <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                           type="button" 
                                           onClick={() => handleDeleteScope(s.id)} 
                                           className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                           title={t('حذف النطاق')}
                                        >
                                           <Trash2 className="w-4 h-4" />
                                        </button>
                                     </div>
                                  )}
                               </div>
                            )) || (
                               <p className="col-span-full text-center py-10 text-gray-400 italic">{t('لم يتم تحديد نطاق عمل مفصل بعد لهذا المشروع.')}</p>
                            )}
                         </div>
                      </motion.div>
                    )}

                    {activeProjectTab === 'visits' && (
                      <motion.div 
                        key="visits"
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-6"
                      >
                         <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                               <Plane className="w-6 h-6 text-blue-600" />
                               <h3 className="text-xl font-black text-gray-900">{t('كارت متابعة زيارات المشروع')}</h3>
                            </div>
                         </div>
                         
                         <div className="space-y-4">
                            {projectVisits.map((visit) => (
                              <ProjectVisitCardItem
                                key={visit.id}
                                visit={visit}
                                employees={employees}
                                isPM={isPM}
                                isSaving={savingVisitDate === visit.date}
                                onSave={handleUpdateVisitFollowUp}
                                t={t}
                              />
                            ))}
                            {projectVisits.length === 0 && (
                               <div className="text-center py-20 bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
                                  <Plane className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                                  <p className="text-gray-400 font-black">{t('لا توجد زيارات مرتبطة بمأموريات معتمدة لهذا المشروع')}</p>
                                  <p className="text-xs text-gray-300 mt-1">{t('يتم إنشاء الزيارات تلقائياً عند اعتماد مأموريات للموظفين على هذا المشروع')}</p>
                               </div>
                            )}
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Task Workflow Area */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-4 flex-wrap gap-3">
                    <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar flex-1">
                      <h3 className="text-2xl font-black text-gray-900 whitespace-nowrap">{t('سير العمل')}</h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedProject.phases?.map(p => (
                          <span key={p} className="px-4 py-1.5 rounded-full text-xs font-black bg-gray-100 text-gray-600 whitespace-nowrap">
                            {p}
                          </span>
                        )) || <span className="text-gray-400 text-sm font-medium italic">{t('لم يتم تعريف مراحل')}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {canEditPhases && (
                        <button
                          onClick={() => setIsPhaseModalOpen(true)}
                          className="bg-blue-50 hover:bg-blue-100 border border-blue-200 px-4 py-3 rounded-2xl font-black text-xs text-blue-700 transition-all flex items-center gap-2 shadow-xs whitespace-nowrap cursor-pointer"
                        >
                          <Layers className="w-4 h-4 text-blue-600" />
                          <span>{t('إدارة المراحل')}</span>
                        </button>
                      )}

                      {canCreateTask(selectedProject) && (
                        <button 
                          onClick={() => {
                            setTaskForm({ ...taskForm, phase: selectedProject.phases?.[0] || '' });
                            setIsTaskModalOpen(true);
                          }}
                          className="bg-card text-primary border border-border px-6 py-3 rounded-2xl font-black hover:bg-primary/10 transition-all flex items-center gap-2 shadow-sm whitespace-nowrap cursor-pointer"
                        >
                          <Plus className="w-5 h-5" />{t('إضافة مهمة')}</button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-6 overflow-x-auto pb-8 snap-x custom-scrollbar">
                    {selectedProject.phases?.map(phaseName => (
                      <div key={phaseName} className="min-w-[320px] max-w-[320px] snap-center space-y-4">
                        <div className="p-4 bg-muted rounded-2xl border border-border flex items-center justify-between group">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Layers className="w-5 h-5 text-primary shrink-0" />
                            <span className="font-black text-foreground truncate">{phaseName}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {canEditPhases && (
                              <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPhaseOldName(phaseName);
                                    setEditingPhaseNewName(phaseName);
                                    setIsPhaseModalOpen(true);
                                  }}
                                  className="p-1 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                  title={t('تعديل المرحلة')}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePhase(phaseName)}
                                  className="p-1 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                  title={t('حذف المرحلة')}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <span className="text-xs font-black text-muted-foreground bg-card px-2 py-0.5 rounded-lg border border-border shrink-0">
                              {projectSpecificTasks.filter(t => t.phase === phaseName && !t.parentTaskId).length}
                            </span>
                          </div>
                        </div>
                        <TaskList 
                          tasks={projectSpecificTasks.filter(t => t.phase === phaseName && !t.parentTaskId)} 
                          onStatusUpdate={handleUpdateTaskStatus}
                          employees={employees}
                          onViewDetails={(id) => {
                             setViewingTaskId(id);
                             setIsTaskDetailsOpen(true);
                           }}
                         />
                       </div>
                     ))}

                    {/* UNPHASED / GENERAL PROJECT TASKS */}
                    {(() => {
                      const unphasedTasks = projectSpecificTasks.filter(
                        t => (!t.phase || !selectedProject.phases?.includes(t.phase)) && !t.parentTaskId
                      );
                      if (unphasedTasks.length === 0) return null;
                      return (
                        <div className="min-w-[320px] max-w-[320px] snap-center space-y-4">
                          <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 flex items-center justify-between group">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Layers className="w-5 h-5 text-amber-600 shrink-0" />
                              <span className="font-black text-foreground truncate">{t('مهام عامة / بدون مرحلة')}</span>
                            </div>
                            <span className="text-xs font-black text-amber-700 bg-background px-2 py-0.5 rounded-lg border border-amber-500/20 shrink-0">
                              {unphasedTasks.length}
                            </span>
                          </div>
                          <TaskList 
                            tasks={unphasedTasks} 
                            onStatusUpdate={handleUpdateTaskStatus}
                            employees={employees}
                            onViewDetails={(id) => {
                               setViewingTaskId(id);
                               setIsTaskDetailsOpen(true);
                             }}
                           />
                        </div>
                      );
                    })()}
                   </div>
                 </div>
               </motion.div>
             ) : (
               <div className="flex flex-col items-center justify-center py-40 text-muted-foreground gap-6 bg-card rounded-[3rem] border border-border border-dashed border-2">
                 <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center shadow-inner">
                   <Briefcase className="w-12 h-12 text-muted-foreground" />
                 </div>
                 <div className="text-center">
                   <p className="text-2xl font-black mb-2 text-foreground">{t('اختر مشروعاً لمعاينته')}</p>
                   <p className="text-muted-foreground font-medium">{t('ابدأ بإختيار أحد المشاريع من القائمة الجانبية أو أضف مشروعاً جديداً')}</p>
                 </div>
               </div>
             )}
           </AnimatePresence>
         </div>
       </div>

       {/* Project Phase Management Modal */}
       <AnimatePresence>
         {isPhaseModalOpen && selectedProject && (
           <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsPhaseModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card text-foreground border border-border w-full max-w-xl rounded-[2rem] shadow-2xl overflow-hidden p-6 space-y-6">
               <div className="flex justify-between items-center border-b border-border pb-4">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                     <Layers className="w-5 h-5" />
                   </div>
                   <div>
                     <h3 className="text-lg font-black text-foreground">{t('إدارة مراحل المشروع')}</h3>
                     <p className="text-xs text-muted-foreground">{selectedProject.name}</p>
                   </div>
                 </div>
                 <button onClick={() => setIsPhaseModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors cursor-pointer"><X className="w-5 h-5"/></button>
               </div>

               {/* Add new phase input */}
               <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-2">
                 <label className="text-xs font-black text-foreground block">{t('إضافة مرحلة جديدة:')}</label>
                 <div className="flex gap-2">
                   <input
                     type="text"
                     value={addExistingProjectPhaseInput}
                     onChange={(e) => setAddExistingProjectPhaseInput(e.target.value)}
                     placeholder={t('أدخل اسم المرحلة (مثل: التحليل، التصميم، التطوير...)')}
                     className="flex-1 px-4 py-2.5 bg-background border border-border rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-primary"
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPhaseToProject(); } }}
                   />
                   <button
                     type="button"
                     onClick={handleAddPhaseToProject}
                     disabled={!addExistingProjectPhaseInput.trim() || isUpdatingPhases}
                     className="px-4 py-2.5 bg-primary text-primary-foreground font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                   >
                     <Plus className="w-4 h-4" />
                     <span>{t('إضافة')}</span>
                   </button>
                 </div>
               </div>

               {/* Phases List */}
               <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
                 <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">{t('المراحل الحالية للمشروع:')}</p>
                 {(!selectedProject.phases || selectedProject.phases.length === 0) ? (
                   <p className="text-xs text-muted-foreground italic text-center py-6">{t('لا توجد مراحل معرفة للمشروع حتى الآن.')}</p>
                 ) : (
                   selectedProject.phases.map((phaseName) => {
                     const isEditingThis = editingPhaseOldName === phaseName;
                     const phaseTaskCount = projectSpecificTasks.filter(t => t.phase === phaseName && !t.parentTaskId).length;

                     return (
                       <div key={phaseName} className="p-3 bg-muted/20 border border-border rounded-xl flex items-center justify-between gap-3">
                         {isEditingThis ? (
                           <div className="flex items-center gap-2 flex-1">
                             <input
                               type="text"
                               value={editingPhaseNewName}
                               onChange={(e) => setEditingPhaseNewName(e.target.value)}
                               className="flex-1 px-3 py-1.5 bg-background border border-primary rounded-lg text-xs font-black outline-none"
                               autoFocus
                               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveEditedPhase(phaseName); } }}
                             />
                             <button
                               type="button"
                               onClick={() => handleSaveEditedPhase(phaseName)}
                               disabled={isUpdatingPhases}
                               className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer"
                               title={t('حفظ التعديل')}
                             >
                               <Save className="w-4 h-4" />
                             </button>
                             <button
                               type="button"
                               onClick={() => { setEditingPhaseOldName(null); setEditingPhaseNewName(''); }}
                               className="p-1.5 bg-muted text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                               title={t('إلغاء')}
                             >
                               <X className="w-4 h-4" />
                             </button>
                           </div>
                         ) : (
                           <>
                             <div className="flex items-center gap-3">
                               <Layers className="w-4 h-4 text-primary" />
                               <span className="text-xs font-black text-foreground">{phaseName}</span>
                               <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-md border border-primary/20">
                                 {phaseTaskCount} {t('مهام')}
                               </span>
                             </div>

                             <div className="flex items-center gap-1">
                               <button
                                 type="button"
                                 onClick={() => { setEditingPhaseOldName(phaseName); setEditingPhaseNewName(phaseName); }}
                                 className="p-1.5 text-blue-600 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                                 title={t('تعديل اسم المرحلة')}
                               >
                                 <Edit2 className="w-3.5 h-3.5" />
                               </button>
                               <button
                                 type="button"
                                 onClick={() => handleDeletePhase(phaseName)}
                                 className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                 title={t('حذف المرحلة')}
                               >
                                 <Trash2 className="w-3.5 h-3.5" />
                               </button>
                             </div>
                           </>
                         )}
                       </div>
                     );
                   })
                 )}
               </div>

               <div className="flex justify-end pt-2 border-t border-border">
                 <button
                   onClick={() => setIsPhaseModalOpen(false)}
                   className="px-5 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-black text-xs rounded-xl transition-colors cursor-pointer"
                 >
                   {t('إغلاق')}
                 </button>
               </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>

       {/* Project Creation Modal */}
       <AnimatePresence>
         {isProjectModalOpen && (
           <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProjectModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card text-foreground border border-border w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden">
              <div className="p-8 border-b border-border bg-muted/30 flex justify-between items-center">
                <div className="flex gap-4">
                   <button 
                      onClick={() => setActiveProjectModalTab('info')}
                      className={cn("px-4 py-2 font-black text-sm transition-all", activeProjectModalTab === 'info' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
                   >{t('بيانات المشروع')}</button>
                   <button 
                      onClick={() => setActiveProjectModalTab('scope')}
                      className={cn("px-4 py-2 font-black text-sm transition-all", activeProjectModalTab === 'scope' ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}
                   >{t('نطاق المشروع (Scope)')}</button>
                </div>
                <button onClick={() => setIsProjectModalOpen(false)} className="p-2 hover:bg-background rounded-full transition-colors"><X/></button>
              </div>
              <form onSubmit={handleAddProject} className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                {activeProjectModalTab === 'info' && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2 col-span-2">
                        <label className="text-sm font-black text-muted-foreground mr-2">{t('اسم المشروع')}</label>
                        <input required className="w-full px-6 py-4 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold animate-none" value={projectForm.name} onChange={(e) => setProjectForm({...projectForm, name: e.target.value})} placeholder={t('مثال: نظام إدارة الموارد الحكومي')} />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <label className="text-sm font-black text-muted-foreground mr-2">{t('مشروع رئيسي (اختياري)')}</label>
                        <select
                          className="w-full px-6 py-4 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold"
                          value={projectForm.parentProjectId || ''}
                          onChange={(e) => setProjectForm({...projectForm, parentProjectId: e.target.value})}
                        >
                          <option value="">{t('لا يوجد (مشروع رئيسي)')}</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-black text-muted-foreground mr-2">{t('تاريخ البداية')}</label>
                        <input type="date" className="w-full px-6 py-4 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm" value={projectForm.startDate} onChange={(e) => setProjectForm({...projectForm, startDate: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-black text-muted-foreground mr-2">{t('تاريخ النهاية')}</label>
                        <input type="date" className="w-full px-6 py-4 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm" value={projectForm.endDate} onChange={(e) => setProjectForm({...projectForm, endDate: e.target.value})} />
                      </div>
                    </div>

                    <div className="space-y-4 p-6 bg-primary/5 rounded-3xl border border-primary/10">
                       <div className="flex justify-between items-center bg-transparent">
                          <label className="text-sm font-black text-foreground">{t('مراحل المشروع (ديناميكية)')}</label>
                          <div className="flex gap-2">
                            <input 
                              className="px-4 py-2 text-xs bg-background text-foreground border border-border rounded-xl outline-none" 
                              placeholder={t('مرحلة جديدة...')}
                              value={newPhaseInput}
                              onChange={(e) => setNewPhaseInput(e.target.value)}
                            />
                            <button 
                              type="button"
                              onClick={() => {
                                if (!newPhaseInput) return;
                                setProjectForm({ ...projectForm, phases: [...(projectForm.phases || []), newPhaseInput] });
                                setNewPhaseInput('');
                              }}
                              className="p-2 bg-primary text-primary-foreground rounded-xl"
                            ><Plus className="w-4 h-4"/></button>
                          </div>
                       </div>
                       <div className="flex flex-wrap gap-2">
                          {projectForm.phases?.map((p, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-xl border border-border text-xs font-bold text-primary shadow-sm">
                              {p}
                              <button onClick={() => setProjectForm({ ...projectForm, phases: projectForm.phases?.filter((_, i) => i !== idx) })} className="text-red-400 hover:text-red-500 font-sans">×</button>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-black text-muted-foreground mr-2">{t('اسم العميل')}</label>
                        <input required className="w-full px-6 py-4 bg-background text-foreground border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold" value={projectForm.clientName} onChange={(e) => setProjectForm({...projectForm, clientName: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-black text-muted-foreground mr-2">{t('مدير المشروع')}</label>
                        <select required className="w-full px-6 py-4 bg-background text-foreground border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold" value={projectForm.projectManagerId || ''} onChange={(e) => setProjectForm({...projectForm, projectManagerId: e.target.value})}>
                          <option value="">{t('اختر...')}</option>
                          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-black text-muted-foreground mr-2">{t('قائد الاستشاريين')}</label>
                        <select className="w-full px-6 py-4 bg-background text-foreground border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold" value={projectForm.consultantTlId || ''} onChange={(e) => setProjectForm({...projectForm, consultantTlId: e.target.value})}>
                          <option value="">{t('اختر...')}</option>
                          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-black text-muted-foreground mr-2">{t('قائد فريق التطوير')}</label>
                        <select required className="w-full px-6 py-4 bg-background text-foreground border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold" value={projectForm.teamLeaderId || ''} onChange={(e) => setProjectForm({...projectForm, teamLeaderId: e.target.value})}>
                          <option value="">{t('اختر...')}</option>
                          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-sm font-black text-muted-foreground mr-2 text-right block">{t('وصف مختصر')}</label>
                      <textarea className="w-full px-6 py-4 bg-background text-foreground border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary font-medium text-right" value={projectForm.description} onChange={(e) => setProjectForm({...projectForm, description: e.target.value})} placeholder={t('وصف عام للمشروع ونطاق العمل...')} />
                    </div>
                  </motion.div>
                )}

                {activeProjectModalTab === 'scope' && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                     <div className="p-8 bg-primary/5 rounded-[2rem] border border-primary/10 space-y-6">
                        <div className="flex items-center gap-2 mb-2">
                           <Layers className="w-6 h-6 text-primary" />
                           <h4 className="text-lg font-black text-foreground leading-tight">{t('نطاق المشروع (Project Scope)')}</h4>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground leading-relaxed">
                          {t('قم بإضافة "الشرائح" أو أجزاء النطاق الرئيسية للمشروع. سيتم إنشاء "تاسك" تلقائياً لكل شريحة بداخل كل مرحلة من مراحل المشروع التي حددتها في التاب السابقة.')}
                        </p>
                        
                        <div className="flex gap-4">
                          <input 
                            className="flex-1 px-6 py-4 bg-background text-foreground border border-border rounded-[2rem] outline-none focus:ring-2 focus:ring-primary font-bold"
                            placeholder={t('أدخل اسم الشريحة (مثال: واجهة المستخدم UI)...')}
                            value={newScopeInput}
                            onChange={(e) => setNewScopeInput(e.target.value)}
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              if (!newScopeInput.trim()) return;
                              const newScopeId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
                              const newScope = { id: newScopeId, name: newScopeInput.trim() };
                              setProjectForm({ ...projectForm, scope: [...(projectForm.scope || []), newScope] });
                              setNewScopeInput('');
                            }}
                            className="bg-primary text-primary-foreground px-8 rounded-2xl font-black shadow-lg shadow-primary/10 hover:bg-primary/95"
                          >{t('إضافة')}</button>
                        </div>

                        <div className="space-y-2 mt-6">
                           {projectForm.scope?.map(s => (
                              <div key={s.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl">
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                                       <Check className="w-4 h-4" />
                                    </div>
                                    <span className="font-bold text-foreground">{s.name}</span>
                                  </div>
                                 <button 
                                   type="button"
                                   onClick={() => setProjectForm({ ...projectForm, scope: projectForm.scope?.filter(item => item.id !== s.id) })}
                                   className="p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                 >
                                    <Trash2 className="w-4 h-4" />
                                 </button>
                              </div>
                           ))}
                           {(!projectForm.scope || projectForm.scope.length === 0) && (
                              <div className="py-10 text-center text-muted-foreground italic text-sm bg-muted/20 border border-dashed border-border rounded-[2rem]">{t('لم يتم إضافة أي نطاق عمل بعد')}</div>
                           )}
                        </div>
                     </div>
                  </motion.div>
                )}

                <div className="pt-4">
                  <button type="submit" className="w-full py-5 bg-primary text-primary-foreground font-black rounded-2xl shadow-lg hover:bg-primary/95 hover:shadow-xl hover:-translate-y-1 transition-all">{t('حفظ المشروع الجديد وجدولة المهام')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Creation Modal */}
      <AnimatePresence>
        {isTaskModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !isSubmittingTask && setIsTaskModalOpen(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card text-foreground border border-border w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden font-sans">
               <div className="p-4 sm:p-6 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                      <Plus className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-foreground">{t('إضافة مهمة جديدة')}</h3>
                      <p className="text-xs text-muted-foreground font-bold">{t('إسناد وتحديد تفاصيل المهمة والجدول الزمني')}</p>
                    </div>
                  </div>
                  <button onClick={() => !isSubmittingTask && setIsTaskModalOpen(false)} disabled={isSubmittingTask} className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-all cursor-pointer"><X className="w-5 h-5" /></button>
               </div>
               <form onSubmit={handleAddTask} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto min-h-0 custom-scrollbar text-right" dir="rtl">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-muted-foreground text-right block">{t('عنوان المهمة')} <span className="text-destructive">*</span></label>
                    <input required className="w-full px-4 py-3 bg-background text-foreground border border-border rounded-xl outline-none text-right font-bold text-sm focus:ring-2 focus:ring-primary" placeholder={t('مثال: تصميم الهيكل الإنشائي أو مراجعة المخططات')} value={taskForm.title} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} />
                  </div>

                  {/* SUB-TASK SELECTION (الربط بمهمة رئيسية كـ Sub-task) */}
                  <div className="p-3.5 bg-muted/20 border border-border rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                        <GitFork className="w-3.5 h-3.5 text-primary" />
                        <span>{t('الربط بمهمة رئيسية (إنشاء كمهمة فرعية - Sub-task):')}</span>
                      </label>
                      {taskForm.parentTaskId && (
                        <button
                          type="button"
                          onClick={() => {
                            setTaskForm(prev => ({ ...prev, parentTaskId: undefined }));
                            setTaskParentSearch('');
                          }}
                          className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          {t('إلغاء الربط بالمهمة الرئيسية')}
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="relative">
                        <input
                          type="text"
                          value={taskParentSearch}
                          onChange={e => setTaskParentSearch(e.target.value)}
                          placeholder={t('ابحث في المهام لربط هذه المهمة كـ Sub-task...')}
                          className="w-full p-2 pr-8 bg-background text-foreground border border-border text-xs rounded-xl outline-none focus:ring-2 focus:ring-primary font-medium text-right"
                        />
                        <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-3 pointer-events-none" />
                      </div>

                      <select
                        value={taskForm.parentTaskId || ''}
                        onChange={e => {
                          const selectedId = e.target.value;
                          const parent = projectTasks.find(t => t.id === selectedId);
                          setTaskForm(prev => ({
                            ...prev,
                            parentTaskId: selectedId || undefined,
                            projectId: parent?.projectId || prev.projectId,
                            phase: parent?.phase || prev.phase,
                            subPhase: parent?.subPhase || prev.subPhase
                          } as any));
                        }}
                        className="w-full p-2.5 bg-background text-foreground border border-border text-xs rounded-xl font-bold outline-none focus:ring-2 focus:ring-primary cursor-pointer text-right"
                      >
                        <option value="">-- {t('مهمة رئيسية مستقلة (ليست مهمة فرعية)')} --</option>
                        {projectTasks
                          .filter(t => {
                            if (!taskParentSearch.trim()) return true;
                            const q = taskParentSearch.toLowerCase();
                            return (
                              t.title?.toLowerCase().includes(q) ||
                              t.assignedTo?.toLowerCase().includes(q) ||
                              t.description?.toLowerCase().includes(q)
                            );
                          })
                          .map(t => {
                            const isDone = t.status === 'Executed' || t.status === 'Approved' || (t.status as string) === 'Completed';
                            return (
                              <option key={t.id} value={t.id}>
                                {isDone ? '✔ ' : '⏳ '} {t.title} {t.assignedTo ? `(${t.assignedTo})` : ''}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  </div>

                  {/* Project Context & Selection */}
                  {selectedProjectId || selectedProject ? (
                    <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Folder className="w-5 h-5 text-primary shrink-0" />
                        <div>
                          <span className="text-[10px] font-black text-primary uppercase tracking-wider block">{t('المشروع المرتبط')}</span>
                          <span className="text-xs font-black text-foreground">
                            {selectedProject?.name || projects.find(p => p.id === selectedProjectId)?.name || t('المشروع المحدد')}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-primary bg-primary/15 border border-primary/20 px-2.5 py-1 rounded-xl">
                        {t('مرتبط بالمشروع الحالي تلقائياً')}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-black text-muted-foreground text-right block">{t('خيارات الربط بالمشروع')}</label>
                      <div className="grid grid-cols-2 gap-2 mb-1">
                        <button
                          type="button"
                          onClick={() => setTaskForm({...taskForm, projectId: ''} as any)}
                          className={`p-2.5 border rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            !((taskForm as any).projectId)
                              ? 'bg-primary/10 border-primary text-primary shadow-sm'
                              : 'bg-background border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <span>📌</span>
                          <span>{t('بدون مشروع محدد')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (projects.length > 0 && !((taskForm as any).projectId)) {
                              setTaskForm({...taskForm, projectId: projects[0].id} as any);
                            }
                          }}
                          className={`p-2.5 border rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            ((taskForm as any).projectId)
                              ? 'bg-primary/10 border-primary text-primary shadow-sm'
                              : 'bg-background border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <span>📁</span>
                          <span>{t('اختيار مشروع محدد')}</span>
                        </button>
                      </div>
                      <select className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-xl outline-none text-right font-bold text-xs focus:ring-2 focus:ring-primary cursor-pointer" value={(taskForm as any).projectId || ''} onChange={(e) => setTaskForm({...taskForm, projectId: e.target.value} as any)}>
                        <option value="">📌 {t('بدون مشروع محدد (تكليف مباشر/عام)')}</option>
                        {projects.map(p => <option key={p.id} value={p.id}>📁 {p.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Phase, Scope, Priority */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-muted-foreground text-right block">{t('المرحلة (Phase)')}</label>
                      <select className="w-full px-3 py-2.5 bg-background text-foreground border border-border rounded-xl outline-none text-right font-bold focus:ring-2 focus:ring-primary cursor-pointer text-xs" value={taskForm.phase || ''} onChange={(e) => setTaskForm({...taskForm, phase: e.target.value})}>
                        <option value="">{t('بدون مرحلة محددة')}</option>
                        {((projects.find(p => p.id === (selectedProjectId || (taskForm as any).projectId))?.phases) || selectedProject?.phases || []).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-muted-foreground text-right block">{t('نطاق العمل (Scope / WBS)')}</label>
                      <select className="w-full px-3 py-2.5 bg-background text-foreground border border-border rounded-xl outline-none text-right font-bold focus:ring-2 focus:ring-primary cursor-pointer text-xs" value={taskForm.subPhase || ''} onChange={(e) => setTaskForm({...taskForm, subPhase: e.target.value})}>
                        <option value="General">{t('عام (General)')}</option>
                        {((projects.find(p => p.id === (selectedProjectId || (taskForm as any).projectId))?.scope) || selectedProject?.scope || []).map((s: any) => (
                          <option key={s.id || s.name} value={s.name}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-muted-foreground text-right block">{t('الأولوية')}</label>
                      <select className="w-full px-3 py-2.5 bg-background text-foreground border border-border rounded-xl outline-none text-right font-bold focus:ring-2 focus:ring-primary cursor-pointer text-xs" value={(taskForm as any).priority || 'Medium'} onChange={(e) => setTaskForm({...taskForm, priority: e.target.value} as any)}>
                        <option value="Urgent">{t('حرجة جداً / عاجلة')}</option>
                        <option value="High">{t('عالية (High)')}</option>
                        <option value="Medium">{t('متوسطة (Medium)')}</option>
                        <option value="Low">{t('منخفضة (Low)')}</option>
                      </select>
                    </div>
                  </div>

                  {/* Assignees */}
                  <div className="space-y-2">
                     <label className="text-xs font-black text-muted-foreground text-right block">{t('التوجيه والإسناد للموظفين')}</label>
                     
                     {taskForm.assignedToIds && taskForm.assignedToIds.length > 0 && (
                       <div className="flex flex-wrap gap-1.5 mb-1.5">
                         {taskForm.assignedToIds.map(id => {
                            const emp = employees.find(e => e.id === id || e.employeeId === id || e.userId === id);
                            return (
                              <span key={id} className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                <User className="w-3 h-3 text-primary" />
                                {emp?.name || id}
                                <button type="button" onClick={() => setTaskForm({...taskForm, assignedToIds: taskForm.assignedToIds?.filter(i => i !== id)})} className="text-primary hover:text-destructive transition-colors mr-1">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                         })}
                       </div>
                     )}
                     
                     <select 
                        className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-xl outline-none text-right font-bold text-xs focus:ring-2 focus:ring-primary cursor-pointer" 
                        value="" 
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val && !taskForm.assignedToIds?.includes(val)) {
                            setTaskForm({...taskForm, assignedToId: val, assignedToIds: [...(taskForm.assignedToIds || []), val]});
                          }
                        }}
                     >
                        <option value="">{t('اختر موظف لإسناد المهمة إليه...')}</option>
                        {employees.filter(e => !taskForm.assignedToIds?.includes(e.id)).map(e => <option key={e.id} value={e.id}>{e.name} ({e.jobTitle || 'موظف'})</option>)}
                     </select>
                  </div>

                  {/* Dates & Estimated Hours */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-muted-foreground text-right block flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        <span>{t('تاريخ البداية')}</span>
                      </label>
                      <input type="date" className="w-full px-3 py-2.5 bg-background text-foreground border border-border rounded-xl outline-none font-bold text-xs focus:ring-2 focus:ring-primary" value={taskForm.startDate} onChange={(e) => setTaskForm({...taskForm, startDate: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-muted-foreground text-right block flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-rose-500" />
                        <span>{t('نهاية المهمة (الاستحقاق)')}</span>
                      </label>
                      <input type="date" className="w-full px-3 py-2.5 bg-background text-foreground border border-border rounded-xl outline-none font-bold text-xs focus:ring-2 focus:ring-primary" value={taskForm.endDate} onChange={(e) => setTaskForm({...taskForm, endDate: e.target.value})} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-muted-foreground text-right block flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>{t('الاستميت تايم (ساعات)')}</span>
                      </label>
                      <input type="number" min="0" step="0.5" placeholder="0" className="w-full px-3 py-2.5 bg-background text-foreground border border-border rounded-xl outline-none font-bold text-xs focus:ring-2 focus:ring-primary" value={taskForm.estimatedHours || ''} onChange={(e) => setTaskForm({...taskForm, estimatedHours: Number(e.target.value)})} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-muted-foreground text-right block">{t('وصف وتفاصيل المهمة')}</label>
                    <textarea className="w-full px-4 py-2.5 bg-background text-foreground border border-border rounded-xl outline-none h-24 resize-none text-right font-medium text-xs leading-relaxed focus:ring-2 focus:ring-primary" placeholder={t('أدخل تفاصيل ومخرجات المهمة المطلوبة بدقة...')} value={taskForm.description} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} />
                  </div>

                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={isSubmittingTask}
                      className="w-full py-3.5 bg-primary text-primary-foreground font-black text-sm rounded-xl shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmittingTask ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t('جاري إنشاء وإسناد المهمة...')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{t('إنشاء المهمة وتوجيهها (مرة واحدة)')}</span>
                        </>
                      )}
                    </button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Details Modal */}
      <AnimatePresence>
        {isTaskDetailsOpen && viewingTask && (
          <div className="fixed inset-0 z-[998] flex items-center justify-center p-4 font-sans">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsTaskDetailsOpen(false)} className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-card text-foreground border border-border w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col font-sans">
               <div className="p-6 sm:p-8 border-b border-border bg-muted/30 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg font-sans">
                        <Layers className="w-6 h-6" />
                     </div>
                     <div>
                        {viewingTask.parentTaskId && projectTasks.find(t => t.id === viewingTask.parentTaskId) && (
                           <button 
                             onClick={() => setViewingTaskId(viewingTask.parentTaskId!)}
                             className="flex items-center gap-1 text-xs font-black text-primary mb-1 hover:underline transition-colors cursor-pointer"
                           >
                              <ChevronRight className="w-3 h-3"/>
                              العودة للمهمة الرئيسية: {projectTasks.find(t => t.id === viewingTask.parentTaskId)?.title}
                           </button>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-2xl font-black text-foreground font-sans">{viewingTask.title}</h3>
                          <span className={cn(
                            "text-[10px] font-black px-2.5 py-0.5 rounded-full border",
                            viewingTask.status === 'Approved' || viewingTask.status === 'Executed' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" :
                            viewingTask.status === 'In Progress' ? "bg-blue-500/10 text-blue-600 border-blue-500/30" :
                            viewingTask.status === 'Under Review' ? "bg-amber-500/10 text-amber-600 border-amber-500/30" :
                            viewingTask.status === 'Rejected' ? "bg-rose-500/10 text-rose-600 border-rose-500/30" : "bg-muted text-muted-foreground border-border"
                          )}>
                            {viewingTask.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground font-sans mt-1">
                          <span>{projects.find(p => p.id === viewingTask.projectId)?.name || (viewingTask.projectId ? 'مشروع مرتبط' : '📌 بدون مشروع (عام)')}</span>
                          <span>•</span>
                          <span>المرحلة: {viewingTask.phase || 'غير محددة'}</span>
                          <span>•</span>
                          <span>نطاق العمل: {viewingTask.subPhase || 'عام'}</span>
                        </div>
                     </div>
                  </div>
                  <button onClick={() => setIsTaskDetailsOpen(false)} className="p-3 bg-background border border-border text-foreground rounded-2xl hover:bg-muted transition-all cursor-pointer"><X /></button>
               </div>

               <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-x divide-x-reverse divide-border font-sans" dir="rtl">
                  {/* Details Sidebar */}
                  <div className="w-full md:w-80 p-6 sm:p-8 space-y-6 bg-muted/20 overflow-y-auto custom-scrollbar border-l border-border font-sans">
                     <div className="space-y-5">
                        {/* Project Info Block */}
                        <div className="space-y-1.5 p-3 bg-background/80 border border-border rounded-2xl">
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-wider">
                            <Folder className="w-3.5 h-3.5 text-primary" />
                            <span>{t('المشروع')}</span>
                          </div>
                          <p className="text-xs font-black text-foreground">
                            {projects.find(p => p.id === viewingTask.projectId)?.name || (viewingTask.projectId ? 'مشروع رقم #' + viewingTask.projectId.slice(0, 6) : '📌 بدون مشروع محدد')}
                          </p>
                        </div>

                        {/* Phase & Scope Block */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 bg-background/80 border border-border rounded-2xl space-y-1">
                            <span className="text-[10px] font-black text-muted-foreground block">{t('المرحلة')}</span>
                            <span className="text-xs font-bold text-foreground block truncate">{viewingTask.phase || '—'}</span>
                          </div>
                          <div className="p-3 bg-background/80 border border-border rounded-2xl space-y-1">
                            <span className="text-[10px] font-black text-muted-foreground block">{t('نطاق العمل (WBS)')}</span>
                            <span className="text-xs font-bold text-primary block truncate">{viewingTask.subPhase || 'عام'}</span>
                          </div>
                        </div>

                        {/* Assignees Block */}
                        <div className="space-y-2">
                           <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest"><User className="w-4 h-4 text-primary"/>{t('المسؤولين والتكليف')}</div>
                           <div className="flex flex-wrap gap-1.5">
                             {(() => {
                               const assignedIds = getTaskAssignedIds(viewingTask);
                               if (assignedIds.length === 0) {
                                 return <span className="text-muted-foreground font-medium text-xs">{t('غير محدد')}</span>;
                               }
                               return assignedIds.map(id => {
                                 const emp = employees.find(e => String(e.id) === String(id) || String(e.employeeId) === String(id) || (e.userId && String(e.userId) === String(id)));
                                 return <span key={id} className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold px-2.5 py-1 rounded-xl">{emp?.name || id}</span>;
                               });
                             })()}
                           </div>
                        </div>

                        <DetailBlock icon={<Calendar className="w-4 h-4 text-blue-500"/>} label={t('تاريخ البداية')} value={viewingTask.startDate || 'غير محدد'} />
                        <DetailBlock icon={<Calendar className="w-4 h-4 text-rose-500"/>} label={t('نهاية المهمة (الاستحقاق)')} value={viewingTask.endDate || 'غير محدد'} />
                        <DetailBlock icon={<Clock className="w-4 h-4 text-amber-500"/>} label={t('الاستميت تايم (المقدر)')} value={`${viewingTask.estimatedHours || 0} ساعة`} />
                        <DetailBlock icon={<CheckCircle2 className="w-4 h-4 text-emerald-500"/>} label={t('الحالة الحالية')} value={viewingTask.status} color="blue" />
                        
                        {viewingTask.completedAt && (
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl space-y-1">
                            <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 block">{t('تاريخ ويوم الإنجاز')}</span>
                            <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">{viewingTask.completedAt}</span>
                          </div>
                        )}

                        <div className="pt-4 border-t border-border space-y-3">
                           <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">{t('تحديث حالة المهمة')}</div>
                           {viewingTask.status === 'Pending' && canChangeTaskStatus(viewingTask, selectedProject) && (
                             <button 
                               onClick={() => handleUpdateTaskStatus(viewingTask.id, 'In Progress', 'Began working')}
                               className="w-full py-2.5 bg-primary/10 text-primary border border-primary/20 text-xs font-black rounded-xl hover:bg-primary/20 transition-colors cursor-pointer"
                             >{t('بدء العمل')}</button>
                           )}
                           {viewingTask.status === 'In Progress' && canChangeTaskStatus(viewingTask, selectedProject) && (
                             <button 
                               onClick={() => handleUpdateTaskStatus(viewingTask.id, 'Under Review', 'Ready for Review')}
                               className="w-full py-2.5 bg-primary/10 text-primary border border-primary/20 text-xs font-black rounded-xl hover:bg-primary/20 transition-colors cursor-pointer"
                             >{t('إرسال للمراجعة')}</button>
                           )}
                           {viewingTask.status === 'Under Review' && (
                             <div className="flex flex-col gap-2">
                               {canApproveTask(viewingTask, selectedProject) && (
                                 <button onClick={() => handleUpdateTaskStatus(viewingTask.id, 'Approved', 'Approved')} className="w-full py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-black rounded-xl hover:bg-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"><Check className="w-4 h-4"/>{t('قبول وإنجاز')}</button>
                               )}
                               {canApproveTask(viewingTask, selectedProject) && (
                                 <button onClick={() => handleUpdateTaskStatus(viewingTask.id, 'Rejected', 'Needs more work')} className="w-full py-2.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-black rounded-xl hover:bg-destructive/20 flex items-center justify-center gap-2 cursor-pointer"><X className="w-4 h-4"/>{t('رفض وإرجاع')}</button>
                               )}
                             </div>
                           )}
                           {viewingTask.status === 'Rejected' && canChangeTaskStatus(viewingTask, selectedProject) && (
                             <button 
                               onClick={() => handleUpdateTaskStatus(viewingTask.id, 'In Progress', 'Resuming work')}
                               className="w-full py-2.5 bg-orange-500/10 text-orange-500 border border-orange-500/20 text-xs font-black rounded-xl hover:bg-orange-500/20 transition-colors cursor-pointer"
                             >{t('إعادة العمل (تحديث بعد الرفض)')}</button>
                           )}
                           {viewingTask.status === 'Approved' && canCloseTask(viewingTask, selectedProject) && (
                              <button 
                                onClick={() => handleUpdateTaskStatus(viewingTask.id, 'Executed', 'Executed')}
                                className="w-full py-2.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-xs font-black rounded-xl hover:bg-indigo-500/20 cursor-pointer"
                              >{t('تم التنفيذ نهائياً')}</button>
                           )}
                        </div>
                     </div>
                  </div>

                  {/* Main Task Content */}
                  <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
                     <section className="space-y-3">
                        <h4 className="text-lg font-black text-foreground flex items-center gap-2">
                           <FileText className="w-5 h-5 text-primary" />{t('وصف المهمة')}</h4>
                        <div className="p-6 bg-muted/30 rounded-3xl border border-border text-foreground font-medium leading-relaxed font-sans">
                           {viewingTask.description}
                        </div>
                     </section>

                     <section className="space-y-4">
                        <div className="flex justify-between items-center px-2 font-sans">
                           <h4 className="text-lg font-black text-foreground flex items-center gap-2 mb-0">
                              <ListTodo className="w-5 h-5 text-emerald-500" />{t('المهمات الفرعية (Sub-tasks)')}</h4>
                           <button 
                             className="text-xs font-black text-primary-foreground bg-primary px-4 py-2 rounded-xl hover:bg-primary/90 transition shadow-sm font-sans"
                             onClick={() => {
                               setTaskForm({
                                 title: '',
                                 description: '',
                                 phase: viewingTask.phase,
                                 subPhase: viewingTask.subPhase,
                                 assignedToIds: getTaskAssignedIds(viewingTask),
                                 status: 'Pending',
                                 startDate: '',
                                 endDate: '',
                                 estimatedHours: 0,
                                 parentTaskId: viewingTask.id
                               });
                               setIsTaskModalOpen(true);
                             }}
                           >{t('+ إضافة مهمة فرعية كاملة')}</button>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                           {/* Legacy SubTasks Display (Fallback) */}
                           {viewingTask.subTasks && viewingTask.subTasks.length > 0 && viewingTask.subTasks.map(st => (
                              <div key={st.id} className="flex items-center gap-4 p-4 bg-background border border-border rounded-2xl group hover:border-emerald-500/50 transition-all font-sans opacity-70">
                                 <button 
                                   onClick={() => handleToggleSubTask(viewingTask.id, st.id)}
                                   className={cn(
                                     "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all min-w-[1.5rem]",
                                     st.status === 'Completed' ? "bg-emerald-500 border-emerald-500 text-white" : "border-border"
                                   )}
                                 >
                                    {st.status === 'Completed' && <Check className="w-4 h-4 font-sans" />}
                                 </button>
                                 <span className={cn(
                                   "font-bold text-sm font-sans flex-1",
                                   st.status === 'Completed' ? "text-muted-foreground line-through" : "text-foreground font-sans"
                                 )}>
                                    {st.title} <span className="text-[10px] text-orange-400 border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 rounded-full mr-2">{t('نظام قديم')}</span>
                                 </span>
                              </div>
                           ))}

                           {/* New ProjectTask SubTasks */}
                           {projectTasks.filter(t => t.parentTaskId === viewingTask.id).map(childTask => (
                              <div 
                                key={childTask.id} 
                                onClick={() => setViewingTaskId(childTask.id)}
                                className="flex flex-col gap-2 p-4 bg-background border border-border hover:border-primary/50 rounded-2xl cursor-pointer transition-all shadow-sm font-sans"
                              >
                                 <div className="flex items-center justify-between">
                                    <h5 className="font-black text-foreground text-sm flex-1">{childTask.title}</h5>
                                    <span className={cn(
                                      "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter",
                                      childTask.status === 'Approved' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                                      childTask.status === 'Rejected' ? "bg-destructive/10 text-destructive border border-destructive/20" :
                                      childTask.status === 'Under Review' ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" : 
                                      childTask.status === 'In Progress' ? "bg-primary/10 text-primary border border-primary/20" : "bg-muted text-muted-foreground"
                                    )}>
                                       {childTask.status}
                                    </span>
                                 </div>
                                 <div className="flex items-center justify-between mt-1">
                                    <p className="text-xs font-bold text-muted-foreground line-clamp-1">{childTask.description || t('لا يوجد وصف')}</p>
                                    <div className="flex items-center gap-3 shrink-0 mr-4">
                                       <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold"><MessageSquare className="w-3 h-3 text-indigo-400"/> {Array.isArray(childTask.comments) ? childTask.comments.length : 0}</span>
                                       <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold"><Paperclip className="w-3 h-3 text-primary"/> {Array.isArray(childTask.attachments) ? childTask.attachments.length : 0}</span>
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                                   <div className="flex items-center gap-2 flex-1">
                                     <div className="w-5 h-5 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                                        <User className="w-3 h-3 text-muted-foreground" />
                                     </div>
                                     <p className="text-[10px] font-black text-foreground">
                                        {employees.find(e => e.id === childTask.assignedToId)?.name || t('غير موجه')}
                                     </p>
                                   </div>
                                   {/* Quick Actions */}
                                   <div className="flex items-center gap-1">
                                     {childTask.status === 'Pending' && canChangeTaskStatus(childTask, selectedProject) && (
                                       <button onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(childTask.id, 'In Progress', 'Began working'); }} className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-[10px] font-black hover:bg-primary/20">{t('بدء العمل')}</button>
                                     )}
                                     {childTask.status === 'In Progress' && canChangeTaskStatus(childTask, selectedProject) && (
                                       <button onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(childTask.id, 'Under Review', 'Ready'); }} className="px-3 py-1 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 rounded-lg text-[10px] font-black hover:bg-indigo-500/20">{t('تسليم')}</button>
                                     )}
                                     {childTask.status === 'Under Review' && (
                                       <>
                                         {canApproveTask(childTask, selectedProject) && <button onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(childTask.id, 'Approved', 'Approved'); }} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[10px] font-black hover:bg-emerald-500/20">{t('قبول')}</button>}
                                         {canApproveTask(childTask, selectedProject) && <button onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(childTask.id, 'Rejected', 'Needs work'); }} className="px-3 py-1 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-[10px] font-black hover:bg-destructive/20">{t('رفض')}</button>}
                                       </>
                                     )}
                                     {childTask.status === 'Rejected' && canChangeTaskStatus(childTask, selectedProject) && (
                                       <button onClick={(e) => { e.stopPropagation(); handleUpdateTaskStatus(childTask.id, 'In Progress', 'Update'); }} className="px-3 py-1 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-lg text-[10px] font-black hover:bg-orange-500/20">{t('إعادة العمل')}</button>
                                     )}
                                   </div>
                                 </div>
                              </div>
                           ))}

                           {(!viewingTask.subTasks?.length && projectTasks.filter(t => t.parentTaskId === viewingTask.id).length === 0) && (
                              <p className="text-sm text-muted-foreground italic px-6 font-sans">{t('لا توجد مهمات فرعية')}</p>
                           )}
                        </div>
                     </section>

                     {/* Attachments Section */}
                     <section className="space-y-4">
                        <div className="flex justify-between items-center bg-primary/5 p-4 rounded-2xl border border-primary/10">
                           <h4 className="text-lg font-bold text-foreground flex items-center gap-2 font-sans">
                              <Paperclip className="w-5 h-5 text-primary" />{t('المرفقات')}</h4>
                           <div className="flex gap-2">
                              <button
                                onClick={() => handleAddLinkAttachment(viewingTask.id)}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-card border border-primary/20 text-primary hover:bg-primary/5 transition-all shadow-sm"
                              >
                                <ExternalLink className="w-4 h-4" />{t('إضافة رابط')}</button>
                              <input 
                                type="file" 
                                id={`file-upload-${viewingTask.id}`} 
                                className="hidden" 
                                onChange={(e) => handleFileUpload(viewingTask.id, e)} 
                              />
                              <label 
                                htmlFor={`file-upload-${viewingTask.id}`}
                                className={cn(
                                   "flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all",
                                   uploadingFile 
                                     ? "bg-muted text-muted-foreground cursor-not-allowed" 
                                     : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/10 hover:-translate-y-0.5"
                                )}
                              >
                                {uploadingFile ? (
                                  <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>{t('جاري الرفع...')}</>
                                ) : (
                                  <><Upload className="w-4 h-4" />{t('رفع ملف')}</>
                                )}
                              </label>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {viewingTask.attachments?.map((att, idx) => (
                              <a 
                                key={idx} 
                                href={att.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-4 p-4 bg-card border border-border rounded-2xl group hover:border-primary/50 hover:shadow-md transition-all font-sans"
                              >
                                 <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <FileText className="w-6 h-6" />
                                 </div>
                                 <div className="flex-1 overflow-hidden">
                                    <p className="font-bold text-sm text-foreground truncate">{att.name}</p>
                                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                                      <span>{att.uploadedBy}</span>
                                      <span>•</span>
                                      <span>{new Date(att.timestamp).toLocaleDateString('ar-EG')}</span>
                                    </div>
                                 </div>
                                 <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                              </a>
                           )) || <p className="col-span-full text-sm text-muted-foreground italic px-6 font-sans">{t('لا توجد مرفقات لهذه المهمة')}</p>}
                        </div>
                     </section>

                     {/* Task Chat */}
                     <section className="space-y-4">
                        <h4 className="text-lg font-black text-foreground flex items-center gap-2 font-sans">
                           <MessageSquare className="w-5 h-5 text-indigo-600" />{t('المحادثة والتبادل الفني')}</h4>
                        <div className="p-6 bg-muted/30 rounded-3xl border border-border space-y-6 font-sans">
                           <div className="space-y-4 max-h-[300px] overflow-y-auto no-scrollbar scroll-smooth">
                              {Array.isArray(viewingTask.comments) ? viewingTask.comments.map((msg, idx) => (
                                 <div key={idx} className={cn(
                                   "flex flex-col gap-1",
                                   msg.userId === user?.uid ? "items-end" : "items-start"
                                 )}>
                                    <div className="flex items-center gap-2 px-2">
                                       <span className="text-[10px] font-black text-muted-foreground font-sans">{msg.userName}</span>
                                       <span className="text-[9px] font-bold text-muted-foreground/50 font-sans">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('ar-EG') : ''}</span>
                                    </div>
                                    <div className={cn(
                                       "p-4 rounded-2xl max-w-[80%] text-sm font-bold shadow-sm font-sans",
                                       msg.userId === user?.uid ? "bg-indigo-600 text-white rounded-tr-none" : "bg-card text-foreground border border-border rounded-tl-none font-sans shadow-sm"
                                    )}>
                                       {msg.text?.split(' ').map((word, i) => (
                                          word.startsWith('@') ? <span key={i} className="text-yellow-300 font-black font-sans">{word} </span> : <span key={i}>{word} </span>
                                       ))}
                                    </div>
                                 </div>
                              )) : (
                                <p className="text-xs text-gray-400 text-center py-4 font-sans">{t('ابدأ المحادثة حول هذه المهمة...')}</p>
                              )}
                           </div>

                           <div className="flex gap-2 relative">
                              <ChatInputWithMentions 
                                employees={employees}
                                className="flex-1 bg-card px-6 py-4 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm font-sans text-foreground placeholder:text-muted-foreground/40"
                                placeholder={t('اكتب تعليقك... استخدم @ لعمل منشن')}
                                value={chatMessage}
                                onChange={setChatMessage}
                                onSend={() => handleSendChatMessage(viewingTask.id, 'task', chatMessage)}
                              />
                              <button 
                                onClick={() => handleSendChatMessage(viewingTask.id, 'task', chatMessage)}
                                className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all shrink-0"
                              >
                                 <Send className="w-5 h-5 font-sans" />
                              </button>
                           </div>
                        </div>
                     </section>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Project General Chat Modal */}
      <AnimatePresence>
         {isProjectChatOpen && selectedProject && (
            <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsProjectChatOpen(false)} className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" />
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden font-sans border border-border">
                  <div className="p-8 border-b border-border bg-emerald-500/10 flex justify-between items-center shrink-0">
                     <div className="flex items-center gap-4">
                        <MessageSquare className="w-8 h-8 text-emerald-500" />
                        <div className="text-right">
                           <h3 className="text-2xl font-black text-foreground font-sans">{t('محادثة المشروع العامة')}</h3>
                           <p className="text-xs font-bold text-muted-foreground font-sans">{selectedProject.name}</p>
                        </div>
                     </div>
                     <button onClick={() => setIsProjectChatOpen(false)} className="p-3 bg-card border border-border rounded-2xl hover:bg-muted transition-all font-sans text-muted-foreground"><X /></button>
                  </div>
                        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar scroll-smooth font-sans">
                      {Array.isArray(selectedProject.chat) ? selectedProject.chat.map((msg, idx) => (
                         <div key={idx} className={cn(
                           "flex flex-col gap-1",
                           msg.userId === user?.uid ? "items-end" : "items-start"
                        )}>
                           <div className="flex items-center gap-2 px-2">
                              <span className="text-[10px] font-black text-muted-foreground font-sans">{msg.userName}</span>
                              <span className="text-[9px] font-bold text-muted-foreground/50 font-sans">{msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('ar-EG') : ''}</span>
                           </div>
                           <div className={cn(
                              "p-4 rounded-2xl text-sm font-bold shadow-sm max-w-[85%] font-sans",
                              msg.userId === user?.uid ? "bg-emerald-600 text-white rounded-tr-none" : "bg-muted text-foreground border border-border rounded-tl-none font-sans"
                           )}>
                              {msg.text}
                           </div>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground text-center py-10 italic font-sans">{t('لا توجد رسائل عامة بعد. ابدأ النقاش مع الفريق!')}</p>
                      )}
                  </div>
                  <div className="p-8 border-t border-border bg-muted/30 flex gap-2 font-sans">
                     <ChatInputWithMentions 
                       employees={employees}
                       className="flex-1 bg-card px-6 py-4 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-emerald-500 font-bold font-sans text-foreground placeholder:text-muted-foreground/40"
                       placeholder={t('اكتب رسالتك العامة للفريق...')}
                       value={chatMessage}
                       onChange={setChatMessage}
                       onSend={() => handleSendChatMessage(selectedProject.id, 'project', chatMessage)}
                     />
                     <button 
                       onClick={() => handleSendChatMessage(selectedProject.id, 'project', chatMessage)}
                       className="p-4 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all shrink-0"
                     >
                        <Send className="w-5 h-5 font-sans" />
                     </button>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
      </div>
    );
  };

const DetailBlock: React.FC<{ icon: React.ReactNode, label: string, value: string, color?: string }> = ({ icon, label, value, color }) => (
  <div className="text-right">
    <div className="flex items-center justify-end gap-1.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">
       {label}
       {icon}
    </div>
    <div className={cn(
       "text-sm font-black",
       color === 'blue' ? "text-primary" : "text-foreground"
    )}>{value}</div>
  </div>
);

const TaskList: React.FC<{ 
  tasks: ProjectTask[], 
  onStatusUpdate: (id: string, s: TaskStatus, note?: string) => void,
  employees: Employee[],
  onViewDetails: (id: string) => void
}> = ({ tasks, onStatusUpdate, employees, onViewDetails }) => {
  const { t } = useLanguage();
  if (tasks.length === 0) return <div className="text-center py-8 text-muted-foreground italic text-sm">{t('لا توجد مهام في هذه المرحلة')}</div>;

  return (
    <div className="space-y-3">
      {tasks.map(task => (
        <div 
          key={task.id} 
          onClick={() => onViewDetails(task.id)}
          className="bg-card p-5 rounded-[2rem] border border-border shadow-sm hover:shadow-md transition-all group relative cursor-pointer"
        >
          <div className="flex justify-between items-start mb-3">
             <span className={cn(
               "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter",
               task.status === 'Approved' ? "bg-emerald-500/10 text-emerald-500" :
               task.status === 'Rejected' ? "bg-destructive/10 text-destructive" :
               task.status === 'Under Review' ? "bg-orange-500/10 text-orange-500" : 
               task.status === 'In Progress' ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
             )}>
                {task.status}
             </span>
             <div className="flex flex-col items-end">
               <span className="text-[10px] font-bold text-muted-foreground">{task.subPhase}</span>
               {task.estimatedHours ? (
                 <span className="text-[9px] font-black text-primary bg-primary/10 px-2 rounded-full mt-1">
                   {task.estimatedHours} س
                 </span>
               ) : null}
             </div>
          </div>
          <h4 className="font-black text-foreground mb-1 text-right">{task.title}</h4>
          <p className="text-xs text-muted-foreground font-medium mb-4 line-clamp-2 text-right">{task.description}</p>
          
          <div className="flex items-center justify-between py-3 border-t border-border">
             <div className="flex items-center gap-2">
               <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center overflow-hidden">
                  <User className="w-3 h-3 text-muted-foreground" />
               </div>
               <p className="text-[10px] font-black text-foreground">
                  {(() => {
                    const aIds = getTaskAssignedIds(task);
                    if (aIds.length > 0) {
                      const firstEmp = employees.find(e => String(e.id) === String(aIds[0]) || String(e.employeeId) === String(aIds[0]));
                      const name = firstEmp?.name || task.assignedTo || aIds[0];
                      return aIds.length > 1 ? `${name} (+${aIds.length - 1})` : name;
                    }
                    return task.assignedTo || t('غير موجه');
                  })()}
               </p>
             </div>
             <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span className="text-[9px] font-bold">
                  {task.startDate ? new Date(task.startDate).toLocaleDateString('ar-EG') : t('؟')}
                </span>
             </div>
          </div>

          <div className="flex flex-col gap-2 pt-3">
             <div className="flex items-center justify-between mb-1 px-1">
                <div className="flex items-center gap-1.5">
                   {/* Here we only show old simple subtasks length in the card preview if we can't contextually fetch full subtasks length. We pass it via props or check context but simple subtasks is fine for preview or we just don't show full subtask count if we don't have projectTasks. Let's just safely show old subTasks count. */}
                   <ListTodo className="w-3 h-3 text-emerald-500" />
                   <span className="text-[10px] font-black text-muted-foreground">
                      {task.subTasks?.length || 0} فرعية
                   </span>
                </div>
                <div className="flex items-center gap-1.5">
                   <MessageSquare className="w-3 h-3 text-indigo-400" />
                   <span className="text-[10px] font-black text-muted-foreground">{Array.isArray(task.comments) ? task.comments.length : 0}</span>
                </div>
             </div>
             {task.status === 'Pending' && (
               <button 
                 onClick={() => onStatusUpdate(task.id, 'In Progress', 'Began working')}
                 className="w-full py-2 bg-muted text-muted-foreground text-[10px] font-black rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
               >{t('بدء العمل')}</button>
             )}
             {task.status === 'In Progress' && (
               <button 
                 onClick={() => onStatusUpdate(task.id, 'Under Review', 'Ready for Review')}
                 className="w-full py-2 bg-primary/10 text-primary text-[10px] font-black rounded-lg hover:bg-primary/20 transition-colors"
               >{t('إرسال للمراجعة')}</button>
             )}
             {task.status === 'Under Review' && (
               <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => onStatusUpdate(task.id, 'Approved', 'Approved by lead')} className="py-2 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-lg hover:bg-emerald-500/20 flex items-center justify-center gap-1"><Check className="w-3 h-3"/>{t('قبول')}</button>
                 <button onClick={() => onStatusUpdate(task.id, 'Rejected', 'Needs more work')} className="py-2 bg-destructive/10 text-destructive text-[10px] font-black rounded-lg hover:bg-destructive/20 flex items-center justify-center gap-1"><X className="w-3 h-3"/>{t('رفض')}</button>
               </div>
             )}
             {task.status === 'Approved' && (
                <button 
                  onClick={() => onStatusUpdate(task.id, 'Executed', 'Executed')}
                  className="w-full py-2 bg-indigo-500/10 text-indigo-600 text-[10px] font-black rounded-lg hover:bg-indigo-500/20"
                >{t('تم التنفيذ')}</button>
             )}
          </div>
        </div>
      ))}
    </div>
  );
};

interface ProjectVisitCardItemProps {
  visit: {
    id: string;
    date: string;
    formattedArabicDate: string;
    title: string;
    employeeIds: string[];
    reasons?: string[];
    destinations?: string[];
    meetingMinutes?: string;
    attachmentUrl?: string;
    missionStatuses?: string[];
  };
  employees: Employee[];
  isPM: boolean;
  isSaving: boolean;
  onSave: (updated: any) => Promise<void>;
  t: (key: string) => string;
}

const ProjectVisitCardItem: React.FC<ProjectVisitCardItemProps> = ({
  visit,
  employees,
  isPM,
  isSaving,
  onSave,
  t
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(visit.title);
  const [localMinutes, setLocalMinutes] = useState(visit.meetingMinutes || '');
  const [localUrl, setLocalUrl] = useState(visit.attachmentUrl || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setLocalTitle(visit.title);
    setLocalMinutes(visit.meetingMinutes || '');
    setLocalUrl(visit.attachmentUrl || '');
  }, [visit]);

  const attendingEmployees = useMemo(() => {
    return visit.employeeIds.map(empId => {
      const e = employees.find(emp => emp.id === empId || emp.employeeId === empId || String(emp.id) === String(empId));
      return {
        id: empId,
        name: e?.name || empId,
        jobTitle: (e as any)?.jobTitle || (e as any)?.position || 'عضو فريق العمل',
        department: (e as any)?.department || (e as any)?.departmentId || 'العمليات والتشغيل',
        avatar: (e as any)?.photoURL || (e as any)?.avatar || ''
      };
    });
  }, [visit.employeeIds, employees]);

  const handleSaveClick = async () => {
    await onSave({
      ...visit,
      title: localTitle.trim() || visit.title,
      meetingMinutes: localMinutes,
      attachmentUrl: localUrl.trim()
    });
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="bg-card text-foreground rounded-3xl border border-border shadow-xs hover:shadow-md transition-all overflow-hidden">
      {/* Header Banner */}
      <div className="p-6 md:p-8 bg-muted/50 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-xl text-xs font-black">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              {visit.formattedArabicDate || visit.date}
            </span>
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              {t('مأمورية معتمدة ومكتملة')}
            </span>
          </div>

          {isPM && isEditing ? (
            <input
              type="text"
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              className="text-lg md:text-xl font-black text-foreground bg-card px-3 py-1.5 border border-primary rounded-xl outline-none focus:ring-2 focus:ring-primary w-full mt-1"
              placeholder={t('عنوان الزيارة')}
            />
          ) : (
            <h4 className="text-lg md:text-xl font-black text-foreground tracking-tight pt-1">
              {localTitle}
            </h4>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
          {localUrl ? (
            <a
              href={localUrl.startsWith('http') ? localUrl : `https://${localUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl text-xs font-black shadow-xs transition-all hover:scale-105"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{t('فتح محضر الاجتماع والمرفقات')}</span>
            </a>
          ) : null}

          {isPM && (
            <button
              onClick={() => {
                if (isEditing) {
                  handleSaveClick();
                } else {
                  setIsEditing(true);
                }
              }}
              disabled={isSaving}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-black transition-all ${
                isEditing
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                  : 'bg-muted hover:bg-muted/80 text-foreground'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('جاري الحفظ...')}</span>
                </>
              ) : isEditing ? (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>{t('حفظ التعديلات')}</span>
                </>
              ) : (
                <>
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{t('تعديل المحضر واللينك')}</span>
                </>
              )}
            </button>
          )}

          {savedSuccess && (
            <span className="text-xs font-black text-emerald-600 flex items-center gap-1 animate-pulse">
              <Check className="w-4 h-4" />
              {t('تم الحفظ بنجاح')}
            </span>
          )}
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-6 md:p-8 space-y-6">
        {/* Attending Employees list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-muted-foreground flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" />
              <span>{t('الموظفون المشاركون في الزيارة في هذا اليوم')} ({attendingEmployees.length})</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {attendingEmployees.map(emp => (
              <div key={emp.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/60 border border-border hover:bg-muted transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
                  {emp.avatar ? (
                    <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    emp.name.charAt(0)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-foreground truncate">{emp.name}</p>
                  <p className="text-[10px] font-bold text-muted-foreground truncate">{emp.jobTitle}</p>
                </div>
              </div>
            ))}
            {attendingEmployees.length === 0 && (
              <p className="text-xs text-muted-foreground font-medium italic">{t('لم يتم تسجيل موظفين محددين')}</p>
            )}
          </div>
        </div>

        {/* Mission Objectives / Destinations tags if available */}
        {(visit.reasons && visit.reasons.length > 0) && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-muted-foreground block">{t('أهداف وغايات الزيارة الميدانية:')}</label>
            <div className="flex flex-wrap gap-2">
              {visit.reasons.map((r, i) => (
                <span key={i} className="px-3 py-1 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Meeting Minutes Section */}
        <div className="space-y-2">
          <label className="text-xs font-black text-foreground flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            <span>{t('محضر الاجتماع / تفاصيل وملاحظات الزيارة:')}</span>
          </label>

          {isPM && isEditing ? (
            <textarea
              className="w-full bg-card p-4 rounded-2xl border border-border outline-none focus:ring-2 focus:ring-primary font-medium text-foreground text-right min-h-[120px] resize-y text-sm leading-relaxed"
              placeholder={t('اكتب تفاصيل محضر الاجتماع وما تم الاتفاق عليه خلال هذه الزيارة...')}
              value={localMinutes}
              onChange={(e) => setLocalMinutes(e.target.value)}
            />
          ) : (
            <div className="p-4 bg-muted/60 rounded-2xl border border-border min-h-[70px]">
              {localMinutes ? (
                <p className="text-foreground text-sm font-medium whitespace-pre-wrap leading-relaxed">
                  {localMinutes}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs font-medium italic">
                  {t('لا توجد تفاصيل أو محضر اجتماع مسجل لهذه الزيارة حتى الآن.')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Attachment URL / Link to Minutes */}
        <div className="space-y-2 pt-2 border-t border-border">
          <label className="text-xs font-black text-foreground flex items-center gap-1.5">
            <Paperclip className="w-4 h-4 text-primary" />
            <span>{t('رابط مرفق محضر الاجتماع أو المستندات (Google Drive / OneDrive / Cloud Link):')}</span>
          </label>

          {isPM && isEditing ? (
            <div className="flex gap-2 items-center">
              <input
                type="url"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                placeholder="https://drive.google.com/file/d/..."
                className="flex-1 bg-card px-4 py-2.5 rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary text-xs font-mono text-foreground"
                dir="ltr"
              />
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              {localUrl ? (
                <a
                  href={localUrl.startsWith('http') ? localUrl : `https://${localUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold border border-primary/20 transition-colors"
                  dir="ltr"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="truncate max-w-xs">{localUrl}</span>
                </a>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  {t('لم يتم إرفاق رابط لمحضر الاجتماع')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Operations;