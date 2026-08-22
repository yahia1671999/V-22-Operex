import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  User,
  Layout,
  ArrowUpRight,
  ExternalLink,
  MessageCircle,
  Paperclip,
  Check,
  Plane,
  ListTodo,
  MessageSquare,
  Search,
  Plus,
  X,
  Briefcase
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { db, doc, updateDoc, arrayUnion, collection, addDoc } from '../../api';
import { ProjectTask, TaskStatus, WorkflowLog, TaskChatMessage } from '../../types';
import { cn } from '../../lib/utils';
import { ChatInputWithMentions } from '../ChatInputWithMentions';
import { useLanguage } from '../../contexts/LanguageContext';
import { getAssignedEmployeeName, isOpenTask, calculateTaskDelay, getTaskExecutionMetrics, normalizeTaskAssigneeIds, findEmployeeByIdentifier, safeParseWorkflowLog } from '../../lib/taskUtils';
import { StartTaskModal } from '../common/StartTaskModal';
import { CompleteTaskModal } from '../common/CompleteTaskModal';

const TaskChatInput: React.FC<{ 
  taskId: string; 
  onSend: (taskId: string, text: string) => void; 
  employees: any[];
}> = ({ taskId, onSend, employees }) => {
  const { t } = useLanguage();
  const [value, setValue] = React.useState('');
  return (
    <ChatInputWithMentions
      value={value}
      onChange={setValue}
      onSend={() => {
        if (!value.trim()) return;
        onSend(taskId, value);
        setValue('');
      }}
      employees={employees}
      placeholder={t('أضف تعليقاً... استخدم @ لعمل منشن')}
      className="w-full bg-white dark:bg-muted/80 px-4 py-2 rounded-xl border border-gray-200 dark:border-border outline-none focus:border-indigo-500 dark:focus:border-indigo-400 text-xs font-bold text-right font-sans transition-all text-foreground"
    />
  );
};

export const MyTasks: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { projectTasks, projects, employees, refreshData } = useData();
  const { profile, user } = useAuth();
  const { can, canCreatePersonalTask } = usePermissions();
  const canAddPersonalTask = canCreatePersonalTask ? canCreatePersonalTask() : can('self_service.my_tasks.create');

  const [activeTab, setActiveTab] = React.useState<'assignedToMe' | 'assignedByMe' | 'all'>('assignedToMe');

  // New task creation modal state
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    description: '',
    projectId: '',
    assignedToId: '',
    priority: 'Medium',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    estimatedHours: 2,
    phase: ''
  });

  const { assignedToMeTasks, assignedByMeTasks, allTasksCombined } = useMemo(() => {
    if (!profile && !user) return { assignedToMeTasks: [], assignedByMeTasks: [], allTasksCombined: [] };
    
    const idSet = new Set<string>();
    const nameSet = new Set<string>();

    const addId = (val: any) => {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const clean = String(val).trim().toLowerCase();
        idSet.add(clean);
        const noSpace = clean.replace(/\s+/g, '');
        if (noSpace) idSet.add(noSpace);
      }
    };

    const addName = (val: any) => {
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const clean = String(val).trim().toLowerCase();
        nameSet.add(clean);
        idSet.add(clean);
        const noSpace = clean.replace(/\s+/g, '');
        if (noSpace) idSet.add(noSpace);
      }
    };

    addId(profile?.id);
    addId(profile?.employeeId);
    addId((profile as any)?.employeeId);
    addId((profile as any)?.id);
    addId((profile as any)?.userId);
    addId((profile as any)?.email);
    addName((profile as any)?.name);
    addName((profile as any)?.displayName);
    addId(user?.uid);
    addId(user?.email);
    addName(user?.name);
    addName(user?.displayName);

    // Cross-match in employees table
    const uEmail = user?.email ? String(user.email).trim().toLowerCase() : '';
    const uUid = user?.uid ? String(user.uid).trim().toLowerCase() : '';
    const pEmpId = (profile as any)?.employeeId ? String((profile as any)?.employeeId).trim().toLowerCase() : '';
    const pId = (profile as any)?.id ? String((profile as any)?.id).trim().toLowerCase() : '';
    const pName = (profile?.name || user?.displayName || user?.name || '').trim().toLowerCase();

    employees.forEach(e => {
      const eEmail = e.email ? String(e.email).trim().toLowerCase() : '';
      const eUserId = e.userId ? String(e.userId).trim().toLowerCase() : '';
      const eEmpId = e.employeeId ? String(e.employeeId).trim().toLowerCase() : '';
      const eId = e.id ? String(e.id).trim().toLowerCase() : '';
      const eName = e.name ? String(e.name).trim().toLowerCase() : '';

      const isMatch =
        (uEmail && eEmail === uEmail) ||
        (uUid && (eUserId === uUid || eId === uUid)) ||
        (pId && (eId === pId || eUserId === pId || eEmpId === pId)) ||
        (pEmpId && (eEmpId === pEmpId || eId === pEmpId)) ||
        (pName && eName === pName) ||
        (pName && eName && (pName.includes(eName) || eName.includes(pName)));

      if (isMatch) {
        addId(e.id);
        addId(e.employeeId);
        addId(e.userId);
        addId(e.email);
        addName(e.name);
      }
    });

    const validIds = Array.from(idSet);
    const validNames = Array.from(nameSet);

    const isAssignedToMe = (t: ProjectTask) => {
      const assignedToId = t.assignedToId ? String(t.assignedToId).trim().toLowerCase() : '';
      const assignedToName = t.assignedTo ? String(t.assignedTo).trim().toLowerCase() : '';
      const assignedToEmail = (t as any).assignedToEmail ? String((t as any).assignedToEmail).trim().toLowerCase() : '';
      
      let assignedToIds: string[] = [];
      if (Array.isArray(t.assignedToIds)) {
        assignedToIds = t.assignedToIds.map(id => String(id).trim().toLowerCase());
      } else if (typeof t.assignedToIds === 'string' && (t.assignedToIds as string).trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(t.assignedToIds as string);
          if (Array.isArray(parsed)) assignedToIds = parsed.map((id: any) => String(id).trim().toLowerCase());
        } catch (e) {}
      } else if (typeof t.assignedToIds === 'string' && t.assignedToIds) {
        assignedToIds = (t.assignedToIds as string).split(',').map(s => s.trim().toLowerCase());
      }

      return (
        (assignedToId && validIds.includes(assignedToId)) ||
        (assignedToName && validIds.includes(assignedToName)) ||
        (assignedToEmail && validIds.includes(assignedToEmail)) ||
        (assignedToName && validNames.some(n => assignedToName.includes(n) || n.includes(assignedToName))) ||
        assignedToIds.some(id => id && (validIds.includes(id) || validNames.some(n => id.includes(n))))
      );
    };

    const isCreatedOrAssignedByMe = (t: ProjectTask) => {
      const creatorId = t.creatorId ? String(t.creatorId).trim().toLowerCase() : '';
      const createdBy = (t as any).createdBy ? String((t as any).createdBy).trim().toLowerCase() : '';
      const createdByName = (t as any).createdByName ? String((t as any).createdByName).trim().toLowerCase() : '';
      const creatorName = (t as any).creatorName ? String((t as any).creatorName).trim().toLowerCase() : '';
      const assignedBy = (t as any).assignedBy ? String((t as any).assignedBy).trim().toLowerCase() : '';
      const assignedById = (t as any).assignedById ? String((t as any).assignedById).trim().toLowerCase() : '';
      const assignedByName = (t as any).assignedByName ? String((t as any).assignedByName).trim().toLowerCase() : '';
      const authorId = (t as any).authorId ? String((t as any).authorId).trim().toLowerCase() : '';
      const author = (t as any).author ? String((t as any).author).trim().toLowerCase() : '';
      const authorEmail = (t as any).authorEmail ? String((t as any).authorEmail).trim().toLowerCase() : '';
      const userId = (t as any).userId ? String((t as any).userId).trim().toLowerCase() : '';
      const ownerId = (t as any).ownerId ? String((t as any).ownerId).trim().toLowerCase() : '';
      const ownerName = (t as any).ownerName ? String((t as any).ownerName).trim().toLowerCase() : '';

      // Check first log entry in workflowLog
      const taskLogs = safeParseWorkflowLog(t.workflowLog);
      const firstLogUserId = taskLogs[0]?.userId ? String(taskLogs[0].userId).trim().toLowerCase() : '';
      const firstLogUserName = taskLogs[0]?.userName ? String(taskLogs[0].userName).trim().toLowerCase() : '';

      // Check any creation / assign log entry
      const hasCreationLogMatch = taskLogs.some((log, idx) => {
        if (idx > 0 && !log.note?.toLowerCase().includes('creat') && !log.note?.includes('إنشاء') && !log.note?.includes('إسناد')) {
          return false;
        }
        const logUid = log.userId ? String(log.userId).trim().toLowerCase() : '';
        const logUname = log.userName ? String(log.userName).trim().toLowerCase() : '';
        return (logUid && validIds.includes(logUid)) || (logUname && validNames.some(n => logUname.includes(n)));
      });

      return (
        (creatorId && validIds.includes(creatorId)) ||
        (createdBy && (validIds.includes(createdBy) || validNames.some(n => createdBy.includes(n)))) ||
        (createdByName && (validIds.includes(createdByName) || validNames.some(n => createdByName.includes(n)))) ||
        (creatorName && (validIds.includes(creatorName) || validNames.some(n => creatorName.includes(n)))) ||
        (assignedBy && (validIds.includes(assignedBy) || validNames.some(n => assignedBy.includes(n)))) ||
        (assignedById && validIds.includes(assignedById)) ||
        (assignedByName && (validIds.includes(assignedByName) || validNames.some(n => assignedByName.includes(n)))) ||
        (authorId && validIds.includes(authorId)) ||
        (author && (validIds.includes(author) || validNames.some(n => author.includes(n)))) ||
        (authorEmail && validIds.includes(authorEmail)) ||
        (userId && validIds.includes(userId)) ||
        (ownerId && validIds.includes(ownerId)) ||
        (ownerName && (validIds.includes(ownerName) || validNames.some(n => ownerName.includes(n)))) ||
        (firstLogUserId && validIds.includes(firstLogUserId)) ||
        (firstLogUserName && (validIds.includes(firstLogUserName) || validNames.some(n => firstLogUserName.includes(n)))) ||
        Boolean(hasCreationLogMatch)
      );
    };

    // «مُسندة إلي» = المهام التي تم إسنادها للموظف (سواء أنشأها بنفسه أو أسندها له شخص آخر)
    const assignedToMe = projectTasks.filter(t => isAssignedToMe(t));

    // «أسندتها» = المهام التي قام الموظف بإنشائها أو إسنادها (تظهر دائماً حتى لو أسندها لنفسه)
    const assignedByMe = projectTasks.filter(t => isCreatedOrAssignedByMe(t));

    // «الكل» = مجموع المهام المرتبطة بالموظف (مُسندة إليه أو أسندها هو) دون تكرار
    const combinedMap = new Map<string, ProjectTask>();
    assignedToMe.forEach(t => combinedMap.set(t.id, t));
    assignedByMe.forEach(t => combinedMap.set(t.id, t));

    return {
      assignedToMeTasks: assignedToMe,
      assignedByMeTasks: assignedByMe,
      allTasksCombined: Array.from(combinedMap.values())
    };
  }, [projectTasks, profile, user, employees]);

  const [searchTerm, setSearchTerm] = React.useState('');
  const [projectCategoryFilter, setProjectCategoryFilter] = React.useState<'all' | 'with_project' | 'without_project'>('all');

  const myTasks = useMemo(() => {
    if (activeTab === 'assignedByMe') return assignedByMeTasks;
    if (activeTab === 'all') return allTasksCombined;
    return assignedToMeTasks;
  }, [activeTab, assignedToMeTasks, assignedByMeTasks, allTasksCombined]);

  const classifiedTasks = useMemo(() => {
    if (projectCategoryFilter === 'with_project') {
      return myTasks.filter(t => t.projectId && t.projectId !== 'general_tasks_project');
    }
    if (projectCategoryFilter === 'without_project') {
      return myTasks.filter(t => !t.projectId || t.projectId === 'general_tasks_project');
    }
    return myTasks;
  }, [myTasks, projectCategoryFilter]);

  const filteredTasks = useMemo(() => {
    if (!searchTerm.trim()) return classifiedTasks;
    const term = searchTerm.trim().toLowerCase();
    return classifiedTasks.filter(task => {
      const titleMatch = task.title?.toLowerCase().includes(term);
      const descMatch = task.description?.toLowerCase().includes(term);
      const projName = projects.find(p => p.id === task.projectId)?.name || '';
      const projMatch = projName.toLowerCase().includes(term);
      const assignedName = getAssignedEmployeeName(task, employees).toLowerCase();
      const assignedMatch = assignedName.includes(term);
      const phaseMatch = task.phase?.toLowerCase().includes(term);
      return titleMatch || descMatch || projMatch || assignedMatch || phaseMatch;
    });
  }, [classifiedTasks, searchTerm, projects, employees]);

  const stats = useMemo(() => ({
    total: myTasks.length,
    open: myTasks.filter(t => isOpenTask(t.status)).length,
    pending: myTasks.filter(t => t.status === 'Pending').length,
    inProgress: myTasks.filter(t => t.status === 'In Progress').length,
    completed: myTasks.filter(t => t.status === 'Approved' || t.status === 'Executed' || (t.status as string) === 'Completed').length,
  }), [myTasks]);

  const [taskToStart, setTaskToStart] = React.useState<ProjectTask | null>(null);
  const [taskToComplete, setTaskToComplete] = React.useState<ProjectTask | null>(null);

  const handleConfirmStartTask = async (
    taskId: string, 
    startData: { actualStartDate: string; actualStartTime: string; startedAt: string; estimatedHours: number; notes?: string }
  ) => {
    if (!user || !profile) return;
    const task = projectTasks.find(t => t.id === taskId);
    if (!task) return;

    const log: WorkflowLog = {
      fromStatus: task.status,
      toStatus: 'In Progress',
      userId: user.uid,
      userName: profile?.name || user?.displayName || 'User',
      timestamp: new Date().toISOString(),
      note: `بدأ الموظف العمل في ${startData.actualStartDate} الساعة ${startData.actualStartTime} (الوقت التقديري: ${startData.estimatedHours} س)${startData.notes ? ` - ملاحظة: ${startData.notes}` : ''}`
    };

    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        status: 'In Progress',
        actualStartDate: startData.actualStartDate,
        actualStartTime: startData.actualStartTime,
        startedAt: startData.startedAt,
        startDate: task.startDate || startData.actualStartDate,
        estimatedHours: startData.estimatedHours,
        workflowLog: arrayUnion(log),
        updatedAt: new Date().toISOString()
      });
      setTaskToStart(null);
    } catch (error) {
      console.error('Error starting task:', error);
      alert('فشل في بدء المهمة، يرجى المحاولة مرة أخرى.');
    }
  };

  const handleStatusUpdate = async (taskId: string, newStatus: TaskStatus) => {
    if (!user || !profile) return;
    const task = projectTasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Check dependency: cannot close a task if it has open sub-tasks
    if (newStatus === 'Approved' || newStatus === 'Executed') {
      const childTasks = projectTasks.filter(t => t.parentTaskId === taskId);
      const hasOpenChildren = childTasks.some(child => child.status !== 'Approved' && child.status !== 'Executed' && child.status !== 'Rejected');
      if (hasOpenChildren) {
        alert('لا يمكن إغلاق هذه المهمة بسبب وجود مهام فرعية لم يتم استكمالها بعد.');
        return;
      }
    }

    const log: WorkflowLog = {
      fromStatus: task.status,
      toStatus: newStatus,
      userId: user.uid,
      userName: profile?.name || user?.displayName || 'User',
      timestamp: new Date().toISOString(),
      note: newStatus === 'Executed' || newStatus === 'Approved' 
        ? 'تم إنهاء المهمة وتسجيل وقت الإنجاز' 
        : 'Updated from My Tasks'
    };

    const updatePayload: any = {
      status: newStatus,
      workflowLog: arrayUnion(log),
      updatedAt: new Date().toISOString()
    };

    if (newStatus === 'Executed' || newStatus === 'Approved') {
      updatePayload.completedAt = new Date().toISOString();
    }

    try {
      await updateDoc(doc(db, 'projectTasks', taskId), updatePayload);
    } catch (error) {
      console.error('Error updating task status:', error);
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
    } catch (error) {
      console.error('Error updating subtask:', error);
    }
  };

  const [uploadingFile, setUploadingFile] = React.useState(false);

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
        uploadedBy: profile?.name || (user as any)?.displayName || 'User',
        timestamp: new Date().toISOString(),
        source: 'Local',
      };
        
      await updateDoc(doc(db, 'projectTasks', taskId), {
        attachments: arrayUnion(newAttachment),
        updatedAt: new Date().toISOString()
      });
        
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
    } catch (error: any) {
      console.error('Add Link Error:', error);
      alert('حدث خطأ أثناء إضافة الرابط: ' + error.message);
    }
  };

  const handleSendChatMessage = async (taskId: string, text: string) => {
    if (!text.trim() || !user) return;
    
    // Simple mention detection
    const mentions = employees
      .filter(e => text.includes(`@${e.name}`))
      .map(e => e.id);

    const newMessage: TaskChatMessage = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      userId: user.uid,
      userName: profile?.name || user?.displayName || 'User',
      text,
      mentions,
      createdAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'projectTasks', taskId), {
        comments: arrayUnion(newMessage),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.title.trim() || !user) return;
    if (!canAddPersonalTask) {
      alert(t('لا تمتلك صلاحية إضافة مهمة شخصية'));
      return;
    }
    
    setIsSubmittingTask(true);
    try {
      const targetEmpId = newTaskForm.assignedToId || (profile?.employeeId || profile?.id || user.uid);
      const assignedEmp = findEmployeeByIdentifier(targetEmpId, employees);
      const assignedToIds = normalizeTaskAssigneeIds([targetEmpId, assignedEmp?.id, assignedEmp?.employeeId].filter(Boolean) as string[], employees);
      const finalAssignedToIds = assignedToIds.length > 0 ? assignedToIds : [String(targetEmpId)];

      const targetProjectId = newTaskForm.projectId && newTaskForm.projectId !== 'general_tasks_project' 
        ? newTaskForm.projectId 
        : null;

      const newTask: any = {
        title: newTaskForm.title.trim(),
        description: newTaskForm.description?.trim() || '',
        phase: newTaskForm.phase || (targetProjectId ? 'General' : null),
        subPhase: 'General',
        priority: newTaskForm.priority || 'Medium',
        projectId: targetProjectId,
        creatorId: user.uid,
        createdBy: profile?.name || user.displayName || 'User',
        assignedBy: user.uid,
        assignedById: user.uid,
        assignedByName: profile?.name || user.displayName || 'User',
        assignedTo: assignedEmp?.name || profile?.name || user.displayName || 'User',
        assignedToId: assignedEmp?.id || assignedEmp?.employeeId || targetEmpId,
        assignedToIds: finalAssignedToIds,
        parentTaskId: null,
        startDate: newTaskForm.startDate || new Date().toISOString().split('T')[0],
        endDate: newTaskForm.endDate || '',
        estimatedHours: Number(newTaskForm.estimatedHours || 2),
        status: 'Pending',
        workflowLog: [{
          fromStatus: 'Pending',
          toStatus: 'Pending',
          userId: user.uid,
          userName: profile?.name || user.displayName || 'User',
          timestamp: new Date().toISOString(),
          note: `تم إنشاء المهمة وإسنادها إلى ${assignedEmp?.name || profile?.name || 'نفسي'}`
        }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'projectTasks'), newTask);
      await refreshData();
      setIsCreateTaskModalOpen(false);
      setNewTaskForm({
        title: '',
        description: '',
        projectId: '',
        assignedToId: '',
        priority: 'Medium',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        estimatedHours: 2,
        phase: ''
      });
    } catch (err: any) {
      console.error('Error creating task:', err);
      alert('حدث خطأ أثناء إنشاء المهمة: ' + err.message);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-muted-foreground">
        <User className="w-16 h-16 mb-4 opacity-20" />
        <h2 className="text-xl font-black text-gray-900 dark:text-foreground">{t('يُرجى تسجيل الدخول لعرض مهامك')}</h2>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-card p-8 rounded-[3rem] border border-gray-100 dark:border-border/60 shadow-sm">
        <div className="flex items-center gap-6">
          <motion.div 
            className="w-16 h-16 bg-emerald-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-emerald-600/20 cursor-pointer select-none"
            whileHover={{ scale: 1.15, rotate: [0, -10, 10, 0], transition: { duration: 0.4 } }}
            whileTap={{ scale: 0.95 }}
          >
            <CheckCircle2 className="w-8 h-8" />
          </motion.div>
          <div>
            <h1 className="text-4xl font-black text-gray-900 dark:text-foreground leading-tight">{t('مهامي الشخصية')}</h1>
            <p className="text-gray-500 dark:text-muted-foreground font-medium text-lg">أهلاً {profile?.name}، لديك {stats.pending + stats.inProgress} مهام نشطة اليوم</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title={t('إجمالي المهام')} value={stats.total} icon={<Layout/>} color="gray" />
        <StatCard title={t('بانتظار البدء')} value={stats.pending} icon={<Clock/>} color="orange" />
        <StatCard title={t('قيد التنفيذ')} value={stats.inProgress} icon={<Clock/>} color="blue" />
        <StatCard title={t('مكتملة / مقبولة')} value={stats.completed} icon={<CheckCircle2/>} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-4">
            <h3 className="text-2xl font-black text-gray-900 dark:text-foreground">{t('قائمة المهام')}</h3>
            <div className="flex gap-1.5 p-1 bg-gray-100 dark:bg-muted/80 rounded-2xl border border-gray-200 dark:border-border">
              <button
                onClick={() => setActiveTab('assignedToMe')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap",
                  activeTab === 'assignedToMe'
                    ? "bg-white dark:bg-card text-emerald-600 dark:text-emerald-400 shadow-sm"
                    : "text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground"
                )}
              >
                📌 {t('مُسندة إلي')} ({assignedToMeTasks.length})
              </button>
              <button
                onClick={() => setActiveTab('assignedByMe')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap",
                  activeTab === 'assignedByMe'
                    ? "bg-white dark:bg-card text-indigo-600 dark:text-emerald-400 shadow-sm"
                    : "text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground"
                )}
              >
                📤 {t('أسندتها')} ({assignedByMeTasks.length})
              </button>
              <button
                onClick={() => setActiveTab('all')}
                className={cn(
                  "px-3.5 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap",
                  activeTab === 'all'
                    ? "bg-white dark:bg-card text-gray-900 dark:text-foreground shadow-sm"
                    : "text-gray-500 dark:text-muted-foreground hover:text-gray-900 dark:hover:text-foreground"
                )}
              >
                📋 {t('الكل')} ({allTasksCombined.length})
              </button>
            </div>
          </div>

          {/* Classification Filter Tabs: All / Tasks on Project / Tasks without Project */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-card rounded-2xl border border-gray-100 dark:border-border">
            <span className="text-xs font-black text-muted-foreground ml-1">{t('تصنيف المهام:')}</span>
            <button
              type="button"
              onClick={() => setProjectCategoryFilter('all')}
              className={cn(
                "px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                projectCategoryFilter === 'all'
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-white dark:bg-muted text-muted-foreground border border-border hover:bg-muted"
              )}
            >
              <span>{t('جميع المهام')}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono">{myTasks.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setProjectCategoryFilter('with_project')}
              className={cn(
                "px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                projectCategoryFilter === 'with_project'
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white dark:bg-muted text-muted-foreground border border-border hover:bg-muted"
              )}
            >
              <span>📁 {t('مهام على مشروع')}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono">
                {myTasks.filter(t => t.projectId && t.projectId !== 'general_tasks_project').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setProjectCategoryFilter('without_project')}
              className={cn(
                "px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5",
                projectCategoryFilter === 'without_project'
                  ? "bg-amber-600 text-white shadow-sm"
                  : "bg-white dark:bg-muted text-muted-foreground border border-border hover:bg-muted"
              )}
            >
              <span>📌 {t('مهام بدون مشروع')}</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono">
                {myTasks.filter(t => !t.projectId || t.projectId === 'general_tasks_project').length}
              </span>
            </button>
          </div>

          <div className="relative px-4 my-2">
            <Search className="w-4 h-4 absolute right-7 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('البحث باسم الموظف، عنوان المهمة، المشروع، أو الوصف...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            />
          </div>

          {filteredTasks.length === 0 ? (
            <div className="bg-white dark:bg-card p-20 rounded-[3rem] border border-dashed border-gray-200 dark:border-border text-center">
               <p className="text-gray-400 dark:text-muted-foreground font-bold italic">
                 {searchTerm ? t('لا توجد نتائج تطابق البحث') : (activeTab === 'assignedByMe' ? t('لا توجد مهام قمت بإنشائها أو إسنادها') : t('لا توجد مهام موجهة إليك حالياً'))}
               </p>
            </div>
          ) : (
            filteredTasks.map(task => {
              const projObj = task.projectId && task.projectId !== 'general_tasks_project' ? projects.find(p => p.id === task.projectId) : null;
              const metrics = getTaskExecutionMetrics(task);
              return (
              <motion.div 
                key={task.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-card p-6 rounded-[2.5rem] border border-gray-100 dark:border-border/50 shadow-sm hover:shadow-md transition-all group overflow-hidden"
              >
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex gap-2 flex-wrap items-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      task.status === 'Pending' ? "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400" :
                      task.status === 'In Progress' ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" :
                      "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"
                    )}>
                      {task.status}
                    </span>
                    {task.phase && (
                      <span className="px-3 py-1 bg-gray-50 dark:bg-muted text-gray-500 dark:text-gray-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {task.phase}
                      </span>
                    )}
                    {(task as any).priority && (
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-black",
                        (task as any).priority === 'Urgent' ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400" :
                        (task as any).priority === 'High' ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" :
                        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      )}>
                        {(task as any).priority === 'Urgent' ? 'عاجلة جداً' : (task as any).priority === 'High' ? 'عالية' : (task as any).priority === 'Low' ? 'منخفضة' : 'متوسطة'}
                      </span>
                    )}
                  </div>
                  <div>
                    {projObj ? (
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 rounded-full text-xs font-black flex items-center gap-1">
                        📁 {projObj.name}
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 rounded-full text-xs font-black flex items-center gap-1">
                        📌 بدون مشروع (تكليف عام)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3 bg-muted/30 px-3 py-1.5 rounded-xl w-fit">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-bold text-foreground">
                    المسند إليه: <span className="text-primary font-black">{getAssignedEmployeeName(task, employees)}</span>
                  </span>
                </div>

                <h4 className="text-xl font-black text-gray-900 dark:text-foreground mb-2 text-right">{task.title}</h4>
                <p className="text-sm text-gray-500 dark:text-muted-foreground font-medium mb-4 text-right line-clamp-3">{task.description}</p>

                {/* Timeline & Execution Parameters (وقت الإسناد، Estimated Time، وقت البدء، وقت الانتهاء، الوقت الفعلي، التأخير) */}
                <div className="bg-muted/20 border border-border/70 rounded-2xl p-3.5 mb-5 font-sans">
                  <div className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center justify-between border-b border-border/50 pb-1.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>سجل التنفيذ والتوقيت الفعلي والمقدر</span>
                    </span>
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black border font-sans", metrics.statusBadge.color)}>
                      {metrics.statusBadge.text}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-right">
                    <DetailItem 
                      icon={<Calendar className="w-3 h-3 text-muted-foreground"/>} 
                      label={t('وقت الإسناد')} 
                      value={metrics.assignedAtFormatted} 
                    />
                    <DetailItem 
                      icon={<Clock className="w-3 h-3 text-amber-500"/>} 
                      label={t('الوقت التقديري')} 
                      value={metrics.estimatedHoursFormatted} 
                    />
                    <DetailItem 
                      icon={<Clock className="w-3 h-3 text-blue-500"/>} 
                      label={t('وقت البدء')} 
                      value={metrics.startedAtFormatted} 
                    />
                    <DetailItem 
                      icon={<Calendar className="w-3 h-3 text-emerald-500"/>} 
                      label={t('وقت الانتهاء')} 
                      value={metrics.completedAtFormatted} 
                    />
                    <DetailItem 
                      icon={<Clock className="w-3 h-3 text-indigo-500"/>} 
                      label={t('الوقت الفعلي')} 
                      value={metrics.actualTimeFormatted} 
                    />
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-1 text-[9px] font-black text-gray-400 dark:text-muted-foreground uppercase tracking-tighter mb-0.5">
                        {t('التأخير')}
                        <AlertCircle className={cn("w-3 h-3", metrics.isDelayed ? "text-rose-500" : "text-emerald-500")} />
                      </div>
                      <div className={cn("text-[11px] font-black font-sans", metrics.isDelayed ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
                        {metrics.delayFormatted}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-2 items-center flex-wrap">
                    {task.status === 'Pending' && (
                      <>
                        <ActionButton onClick={() => setTaskToStart(task)} label={t('بدء التنفيذ')} color="blue" />
                        <ActionButton onClick={() => setTaskToComplete(task)} label={t('نهيتها (إتمام المهمة)')} color="emerald" />
                      </>
                    )}
                    {task.status === 'In Progress' && (
                      <>
                        <ActionButton onClick={() => setTaskToComplete(task)} label={t('نهيتها (إتمام المهمة)')} color="emerald" />
                        <button
                          onClick={() => setTaskToStart(task)}
                          className="px-4 py-2.5 rounded-xl font-bold text-xs bg-muted text-muted-foreground hover:text-foreground border border-border transition-all cursor-pointer"
                        >
                          {t('تعديل البدء/المقدر')}
                        </button>
                        <ActionButton onClick={() => handleStatusUpdate(task.id, 'Under Review')} label={t('إرسال للمراجعة')} color="blue" />
                      </>
                    )}
                    {task.status === 'Under Review' && (
                      <>
                        <ActionButton onClick={() => setTaskToComplete(task)} label={t('تأكيد النهو (تم الإنجاز)')} color="emerald" />
                        <span className="text-xs font-black text-orange-500 px-3 py-1.5 border border-orange-200 dark:border-orange-950/40 bg-orange-50 dark:bg-orange-950/20 rounded-xl flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {t('جاري المراجعة الإدارية...')}
                        </span>
                      </>
                    )}
                    {(task.status === 'Executed' || task.status === 'Approved') && (
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 px-3 py-1.5 border border-emerald-200 dark:border-emerald-950/40 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {task.status === 'Approved' ? t('مكتملة وموافق عليها') : t('تم إنهاؤها وبانتظار اعتماد المدير')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4">
                     {task.subTasks && task.subTasks.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 dark:bg-muted rounded-full">
                           <ListTodo className="w-3 h-3 text-emerald-500" />
                           <span className="text-[10px] font-black text-gray-500 dark:text-gray-400">
                              {task.subTasks.filter(st => st.status === 'Completed').length} / {task.subTasks.length}
                           </span>
                        </div>
                     )}
                     <div className="flex gap-3">
                        <button 
                           onClick={() => {
                             const el = document.getElementById(`chat-section-${task.id}`);
                             if (el) el.classList.toggle('hidden');
                           }}
                           className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative focus:outline-none"
                        >
                           <MessageCircle className="w-5 h-5"/>
                           {task.comments && task.comments.length > 0 && (
                              <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                                 {task.comments.length}
                              </span>
                           )}
                        </button>
                        <button 
                          onClick={() => {
                             const el = document.getElementById(`attachments-section-${task.id}`);
                             if (el) el.classList.toggle('hidden');
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none relative"
                        >
                          <Paperclip className="w-5 h-5"/>
                          {task.attachments && task.attachments.length > 0 && (
                            <span className="absolute -top-1 -left-1 w-4 h-4 bg-blue-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                               {task.attachments.length}
                            </span>
                          )}
                        </button>
                     </div>
                  </div>
                </div>

                {/* Always rendered sections, controllable by clicking icons or available if in progress */}
                <div className="mt-6 space-y-4">
                  {(task.subTasks && task.subTasks.length > 0) || projectTasks.filter(ct => ct.parentTaskId === task.id).length > 0 ? (
                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-border/40">
                       <p className="text-[10px] font-black text-gray-400 dark:text-muted-foreground uppercase tracking-widest text-right">{t('المهمات الفرعية المرتبطة')}</p>
                       <div className="grid grid-cols-1 gap-2">
                          {/* Legacy simple subtasks */}
                          {task.subTasks?.map(st => (
                             <button 
                                key={st.id}
                                onClick={() => handleToggleSubTask(task.id, st.id)}
                                className="flex items-center justify-between p-3 bg-gray-50/50 dark:bg-muted/40 rounded-xl hover:bg-white dark:hover:bg-card hover:shadow-sm transition-all border border-transparent hover:border-gray-100 dark:hover:border-border/40"
                             >
                                <div className={cn(
                                   "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                                   st.status === 'Completed' ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 dark:border-border/80"
                                )}>
                                   {st.status === 'Completed' && <Check className="w-3 h-3" />}
                                </div>
                                <span className={cn(
                                   "text-right text-xs font-bold font-sans flex-1 ml-4 line-clamp-2",
                                   st.status === 'Completed' ? "text-gray-400 dark:text-muted-foreground line-through" : "text-gray-700 dark:text-slate-200"
                                )}>{st.title}</span>
                             </button>
                          ))}
                          {/* New Full task childs */}
                          {projectTasks.filter(ct => ct.parentTaskId === task.id).map(ct => (
                             <div key={ct.id} className="p-3 bg-blue-50/30 dark:bg-blue-950/10 rounded-xl flex items-center justify-between border border-blue-50 dark:border-blue-950/30">
                               <div className="flex gap-2 items-center">
                                  <ListTodo className="w-4 h-4 text-blue-500" />
                                  <span className="text-right text-xs font-bold text-gray-800 dark:text-slate-200 font-sans">{ct.title}</span>
                               </div>
                               <span className={cn(
                                 "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter",
                                 ct.status === 'Approved' ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" :
                                 ct.status === 'Rejected' ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400" :
                                 ct.status === 'Under Review' ? "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400" : 
                                 ct.status === 'In Progress' ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400" : "bg-white dark:bg-muted text-gray-500 dark:text-gray-400"
                               )}>
                                  {ct.status}
                               </span>
                             </div>
                          ))}
                       </div>
                    </div>
                  ) : null}

                  {/* Attachments Section */}
                  <div id={`attachments-section-${task.id}`} className={cn("space-y-3 pt-4 border-t border-gray-100 dark:border-border/30", task.status === 'In Progress' ? "block" : "hidden")}>
                      <div className="flex justify-between items-center bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded-xl border border-blue-50 dark:border-blue-950/30 text-right">
                         <div className="flex gap-2 items-center">
                            <Paperclip className="w-4 h-4 text-blue-600 dark:text-blue-450" />
                            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest whitespace-nowrap">{t('المرفقات')}</span>
                         </div>
                         <div className="flex gap-2">
                            <button
                              onClick={() => handleAddLinkAttachment(task.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs bg-white dark:bg-card border border-blue-200 dark:border-blue-950/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20 transition-all shadow-sm"
                            >{t('إضافة رابط')}</button>
                            <input 
                              type="file" 
                              id={`file-upload-mytasks-${task.id}`} 
                              className="hidden" 
                              onChange={(e) => handleFileUpload(task.id, e)} 
                            />
                            <label 
                              htmlFor={`file-upload-mytasks-${task.id}`}
                              className={cn(
                                 "flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-all",
                                 uploadingFile 
                                   ? "bg-gray-200 dark:bg-muted text-gray-500 dark:text-gray-400 cursor-not-allowed" 
                                   : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 dark:shadow-none"
                              )}
                            >
                              {uploadingFile ? (
                                <><span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>{t('جاري الرفع...')}</>
                              ) : (
                                <>{t('رفع ملف')}</>
                              )}
                            </label>
                         </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                         {task.attachments?.map((att, idx) => (
                            <a 
                              key={idx} 
                              href={att.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 bg-white dark:bg-muted/10 border border-gray-100 dark:border-border/50 rounded-xl hover:border-blue-300 dark:hover:border-blue-900/50 hover:shadow-sm transition-all"
                            >
                               <div className="flex flex-col flex-1 truncate text-right">
                                  <p className="font-bold text-xs text-gray-800 dark:text-slate-200 truncate">{att.name}</p>
                                  <div className="flex justify-end gap-1 text-[9px] text-gray-400 dark:text-muted-foreground mt-0.5">
                                    <span>{new Date(att.timestamp).toLocaleDateString('ar-EG')}</span>
                                    <span>•</span>
                                    <span className="truncate">{att.uploadedBy}</span>
                                  </div>
                               </div>
                               <ExternalLink className="w-3 h-3 text-gray-300 mr-2" />
                            </a>
                         ))}
                      </div>
                  </div>

                  {/* Chat Section */}
                  <div id={`chat-section-${task.id}`} className={cn("space-y-3 pt-4 border-t border-gray-50 dark:border-border/30", task.status === 'In Progress' ? "block" : "hidden")}>
                     <p className="text-[10px] font-black text-gray-400 dark:text-muted-foreground uppercase tracking-widest text-right">{t('المحادثات والتعليقات')}</p>
                     <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {Array.isArray(task.comments) ? task.comments.map((c, idx) => (
                           <div key={idx} className={cn(
                             "p-3 rounded-xl border text-right max-w-[85%]",
                             c.userId === user?.uid 
                               ? "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30 mr-auto" 
                               : "bg-white dark:bg-muted/30 border-gray-100 dark:border-border/50 ml-auto"
                           )}>
                              <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 mb-0.5">{c.userName}</p>
                              <p className="text-xs font-medium text-gray-700 dark:text-slate-200">{c.text}</p>
                           </div>
                        )) : (
                          <div className="text-center py-4 text-xs font-bold text-gray-400 dark:text-muted-foreground italic">{t('لا توجد تعليقات حتى الآن.')}</div>
                        )}
                     </div>
                     <div className="flex gap-2">
                       <TaskChatInput 
                         taskId={task.id} 
                         onSend={handleSendChatMessage} 
                         employees={employees} 
                       />
                     </div>
                  </div>
                </div>
              </motion.div>
            );
          })
          )}
        </div>

        <div className="space-y-6">
          <h3 className="text-2xl font-black text-gray-900 dark:text-foreground px-4">{t('إحصائيات الأداء')}</h3>
          <div className="bg-white dark:bg-card p-8 rounded-[3rem] border border-gray-100 dark:border-border/50 shadow-sm space-y-6">
             <div>
                <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-black text-gray-500 dark:text-muted-foreground">{t('نسبة الإنجاز')}</span>
                   <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">%{Math.round((stats.completed / (stats.total || 1)) * 100)}</span>
                </div>
                <div className="w-full h-3 bg-gray-50 dark:bg-muted rounded-full overflow-hidden border border-gray-100 dark:border-border/40">
                   <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.completed / (stats.total || 1)) * 100}%` }}
                    className="h-full bg-emerald-500 shadow-lg shadow-emerald-100 dark:shadow-none"
                   />
                </div>
             </div>

             <div className="space-y-3">
                <p className="text-xs font-black text-gray-400 dark:text-muted-foreground uppercase tracking-widest text-right">{t('تنبيهات هامة')}</p>
                <AlertItem label={t('مهام متأخرة')} count={0} color="red" />
                <AlertItem label={t('بانتظار ردك')} count={stats.pending} color="orange" />
             </div>
          </div>
        </div>
      </div>

      <StartTaskModal
        isOpen={!!taskToStart}
        task={taskToStart}
        onClose={() => setTaskToStart(null)}
        onSuccess={() => setTaskToStart(null)}
      />

      <CompleteTaskModal
        isOpen={!!taskToComplete}
        task={taskToComplete}
        onClose={() => setTaskToComplete(null)}
        onSuccess={() => setTaskToComplete(null)}
      />

      {/* Modal: Create New Task / Personal or Project Task */}
      <AnimatePresence>
        {isCreateTaskModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-card w-full max-w-xl rounded-3xl border border-gray-100 dark:border-border p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-gray-100 dark:border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-foreground">{t('إضافة مهمة جديدة')}</h3>
                    <p className="text-xs text-muted-foreground font-medium">{t('إنشاء مهمة وإسنادها لنفسك أو لأحد أعضاء الفريق')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateTaskModalOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-xl hover:bg-muted transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4 text-right">
                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">{t('عنوان المهمة *')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('مثال: إعداد التقرير المالي، مراجعة تصاميم الواجهات...')}
                    value={newTaskForm.title}
                    onChange={e => setNewTaskForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">{t('الوصف والتفاصيل')}</label>
                  <textarea
                    rows={3}
                    placeholder={t('اكتب شرحاً مختصراً للمهمة والمخرجات المطلوبة...')}
                    value={newTaskForm.description}
                    onChange={e => setNewTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">{t('المشروع المرتبط')}</label>
                    <select
                      value={newTaskForm.projectId}
                      onChange={e => setNewTaskForm(prev => ({ ...prev, projectId: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">📌 {t('بدون مشروع (تكليف عام / شخصي)')}</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>📁 {p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">{t('إسناد إلى')}</label>
                    <select
                      value={newTaskForm.assignedToId}
                      onChange={e => setNewTaskForm(prev => ({ ...prev, assignedToId: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value={profile?.employeeId || profile?.id || user?.uid || ''}>
                        👤 {profile?.name || user?.displayName || 'نفسي'} ({t('إسناد شخصي')})
                      </option>
                      {employees
                        .filter(e => e.id !== profile?.employeeId && e.id !== profile?.id && e.userId !== user?.uid)
                        .map(emp => (
                          <option key={emp.id} value={emp.id}>
                            👥 {emp.name} ({emp.departmentId || emp.role || 'موظف'})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">{t('الأولوية')}</label>
                    <select
                      value={newTaskForm.priority}
                      onChange={e => setNewTaskForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Critical">🔴 {t('حرجة جداً')}</option>
                      <option value="High">🟠 {t('عالية')}</option>
                      <option value="Medium">🟡 {t('متوسطة')}</option>
                      <option value="Low">🟢 {t('منخفضة')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">{t('تاريخ البدء')}</label>
                    <input
                      type="date"
                      value={newTaskForm.startDate}
                      onChange={e => setNewTaskForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">{t('الوقت التقديري (ساعات)')}</label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={newTaskForm.estimatedHours}
                      onChange={e => setNewTaskForm(prev => ({ ...prev, estimatedHours: Number(e.target.value) }))}
                      className="w-full px-3.5 py-2 bg-gray-50 dark:bg-muted/50 border border-gray-200 dark:border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t border-gray-100 dark:border-border justify-end">
                  <button
                    type="button"
                    onClick={() => setIsCreateTaskModalOpen(false)}
                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-muted text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  >
                    {t('إلغاء')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTask}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingTask ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        <span>{t('جاري الحفظ...')}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{t('حفظ وإسناد المهمة')}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatCard: React.FC<{ title: string, value: number, icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white dark:bg-card p-6 rounded-[2.5rem] border border-gray-100 dark:border-border/50 shadow-sm flex items-center justify-between">
    <div className="text-right">
      <p className="text-[10px] font-black text-gray-400 dark:text-muted-foreground uppercase tracking-widest mb-1">{title}</p>
      <p className="text-3xl font-black text-gray-900 dark:text-foreground">{value}</p>
    </div>
    <div className={cn(
      "w-12 h-12 rounded-2xl flex items-center justify-center",
      color === 'orange' ? "bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400" :
      color === 'blue' ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400" :
      color === 'emerald' ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-gray-50 dark:bg-muted text-gray-600 dark:text-gray-450"
    )}>
      {icon}
    </div>
  </div>
);

const DetailItem: React.FC<{ icon: React.ReactNode, label: string, value: string }> = ({ icon, label, value }) => (
  <div className="text-right">
    <div className="flex items-center justify-end gap-1 text-[9px] font-black text-gray-400 dark:text-muted-foreground uppercase tracking-tighter mb-0.5">
      {label}
      {icon}
    </div>
    <div className="text-[11px] font-black text-gray-700 dark:text-slate-300">{value}</div>
  </div>
);

const ActionButton: React.FC<{ onClick: () => void, label: string, color: 'blue' | 'emerald' }> = ({ onClick, label, color }) => (
  <button 
    onClick={onClick}
    className={cn(
      "px-6 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm active:scale-95",
      color === 'blue' ? "bg-blue-600 text-white shadow-blue-100 dark:shadow-none hover:bg-blue-700" : "bg-emerald-600 text-white shadow-emerald-100 dark:shadow-none hover:bg-emerald-700"
    )}
  >
    {label}
  </button>
);

const AlertItem: React.FC<{ label: string, count: number, color: 'red' | 'orange' }> = ({ label, count, color }) => (
  <div className={cn(
    "flex items-center justify-between p-4 rounded-2xl border text-right",
    color === 'red' ? "bg-red-50 dark:bg-red-950/35 border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400" : "bg-orange-50 dark:bg-orange-950/35 border-orange-100 dark:border-orange-900/50 text-orange-600 dark:text-orange-400"
  )}>
    <span className="text-xs font-black">{label}</span>
    <span className="w-6 h-6 bg-white dark:bg-muted rounded-lg flex items-center justify-center text-xs font-black shadow-sm dark:text-foreground">{count}</span>
  </div>
);
