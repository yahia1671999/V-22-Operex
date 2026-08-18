import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, { 
  Node, 
  Edge, 
  Connection, 
  addEdge, 
  Background, 
  Controls, 
  Handle, 
  Position,
  NodeProps,
  BackgroundVariant,
  applyNodeChanges,
  applyEdgeChanges,
  NodeChange,
  EdgeChange,
  MarkerType
} from 'reactflow';
import { useData } from '../../contexts/DataContext';
import { Employee } from '../../types';
import { db, doc, setDoc, updateDoc } from '../../api';
import { motion } from 'framer-motion';
import { MapPin, Briefcase, Users, Link as LinkIcon, AlertCircle, Building2, Network } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';

// Custom Node for Employee
const EmployeeNode = ({ data }: NodeProps<{ employee: Employee, subordinateCount: number }>) => {
  const { employee, subordinateCount } = data;
  const { t } = useLanguage();
  
  return (
    <div className="relative group">
      {/* Top Handle for Parent Connection */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3 h-3 bg-primary border-2 border-background animate-pulse"
        style={{ top: -6 }}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ scale: 1.02 }}
        className={cn(
          "bg-card p-5 rounded-none border border-border shadow-lg w-64 flex flex-col items-center text-center transition-all duration-300",
          !employee.managerId ? "border-primary/50 bg-primary/5 shadow-primary/10" : ""
        )}
      >
        <div className={cn(
          "w-14 h-14 rounded-none flex items-center justify-center text-xl font-black mb-3 shadow-md border-b-2 border-primary",
          !employee.managerId ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          {employee.name?.[0] || '?'}
        </div>
        
        <h4 className="font-black text-foreground text-base mb-0.5 truncate w-full">{employee.name}</h4>
        <p className="text-primary font-bold text-xs mb-3 truncate w-full">{employee.jobTitle}</p>
        
        <div className="w-full pt-3 border-t border-border flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground justify-center">
            <MapPin className="w-2.5 h-2.5" />
            <span className="truncate">{employee.workType === 'Part time' ? t('دوام جزئي') : t('تفرغ كامل')}</span>
          </div>
          {subordinateCount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-black text-primary justify-center mt-1">
              <Users className="w-2.5 h-2.5" />
              <span>{subordinateCount} مرؤوسين</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Bottom Handle for Subordinate Connection */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3 h-3 bg-primary border-2 border-background animate-pulse"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

// Custom Node for Department
const DepartmentNode = ({ data }: NodeProps<{ department: any, employeeCount: number, managerName?: string }>) => {
  const { department, employeeCount, managerName } = data;
  const { t } = useLanguage();
  
  return (
    <div className="relative group">
      {/* Top Handle for Parent Connection */}
      <Handle 
        type="target" 
        position={Position.Top} 
        className="w-3.5 h-3.5 bg-emerald-500 border-2 border-background animate-pulse"
        style={{ top: -7 }}
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ scale: 1.02 }}
        className={cn(
          "bg-card p-6 rounded-none border border-border shadow-xl w-72 flex flex-col items-center text-center transition-all duration-300 border-t-4",
          !department.parentDeptId ? "border-t-emerald-500 bg-emerald-500/5 shadow-emerald-500/10" : "border-t-primary bg-primary/5"
        )}
      >
        <div className={cn(
          "w-14 h-14 rounded-none flex items-center justify-center text-xl font-black mb-3 shadow-md",
          !department.parentDeptId ? "bg-emerald-600 text-white" : "bg-primary text-white"
        )}>
          <Building2 className="w-7 h-7" />
        </div>
        
        <h4 className="font-black text-foreground text-lg mb-1 truncate w-full">{department.name}</h4>
        <p className="text-muted-foreground font-medium text-xs mb-4 line-clamp-1 w-full">{department.description || t('لا يوجد وصف')}</p>
        
        <div className="w-full pt-4 border-t border-dashed border-border flex flex-col gap-2">
          {managerName && (
            <div className="flex items-center gap-2 text-xs font-bold text-foreground justify-center">
              <span className="text-muted-foreground">{t('المدير:')}</span>
              <span className="truncate max-w-[150px] font-black text-primary">{managerName}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 justify-center mt-1 bg-emerald-500/10 py-1 px-3">
            <Users className="w-3.5 h-3.5" />
            <span>{employeeCount} {t('موظف')}</span>
          </div>
        </div>
      </motion.div>

      {/* Bottom Handle for Subordinate Connection */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="w-3.5 h-3.5 bg-emerald-500 border-2 border-background animate-pulse"
        style={{ bottom: -7 }}
      />
    </div>
  );
};

const nodeTypes = {
  employee: EmployeeNode,
  department: DepartmentNode,
};

export const OrgChart: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { employees, adminDepartments, refreshData, systemSettings } = useData();
  const [viewMode, setViewMode] = useState<'employees' | 'departments'>('employees');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const primaryColor = systemSettings?.primaryColor || '#0ea5e9';

  // Update nodes and edges whenever employees, adminDepartments or viewMode changes
  useEffect(() => {
    // DFS Child-relative Tree Layout Helper
    const layoutTree = (
      items: { id: string; parentId: string | null }[],
      horizontalSpacing = 320,
      verticalSpacing = 260
    ) => {
      const childrenMap: Record<string, string[]> = {};
      const allIds = new Set(items.map(i => i.id));
      
      items.forEach(item => {
        if (item.parentId && allIds.has(item.parentId)) {
          if (!childrenMap[item.parentId]) childrenMap[item.parentId] = [];
          childrenMap[item.parentId].push(item.id);
        }
      });

      const roots = items.filter(item => !item.parentId || !allIds.has(item.parentId)).map(item => item.id);
      const positions: Record<string, { x: number; y: number }> = {};
      let currentX = 0;

      const layoutSubtree = (nodeId: string, level: number) => {
        const children = childrenMap[nodeId] || [];
        if (children.length === 0) {
          positions[nodeId] = { x: currentX, y: level * verticalSpacing };
          currentX += horizontalSpacing;
          return;
        }

        children.forEach(childId => layoutSubtree(childId, level + 1));

        const firstChildX = positions[children[0]].x;
        const lastChildX = positions[children[children.length - 1]].x;
        const parentX = (firstChildX + lastChildX) / 2;

        positions[nodeId] = { x: parentX, y: level * verticalSpacing };
      };

      roots.forEach(rootId => {
        layoutSubtree(rootId, 0);
        currentX += horizontalSpacing / 2; // Buffer zone between separate trees
      });

      if (roots.length > 0) {
        const minX = Math.min(...Object.values(positions).map(p => p.x));
        const maxX = Math.max(...Object.values(positions).map(p => p.x));
        const midX = (minX + maxX) / 2;
        Object.keys(positions).forEach(id => {
          positions[id].x -= midX;
        });
      }

      return positions;
    };

    if (viewMode === 'employees') {
      const parentChildPairs = employees.map(emp => ({
        id: emp.id,
        parentId: emp.managerId || null
      }));

      const positions = layoutTree(parentChildPairs, 450, 360);

      const initialNodes: Node[] = employees.map(emp => {
        const pos = positions[emp.id] || { x: 0, y: 0 };
        return {
          id: emp.id,
          type: 'employee',
          position: pos,
          data: { 
            employee: emp,
            subordinateCount: employees.filter(e => e.managerId === emp.id).length
          },
        };
      });

      const initialEdges: Edge[] = employees
        .filter(emp => emp.managerId && employees.some(m => m.id === emp.managerId))
        .map(emp => ({
          id: `e-${emp.managerId}-${emp.id}`,
          source: emp.managerId!,
          target: emp.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: primaryColor, strokeWidth: 4 }, // Thick and clear, matching department style
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 25,
            height: 25,
            color: primaryColor,
          },
        }));

      setNodes(initialNodes);
      setEdges(initialEdges);
    } else {
      const parentChildPairs = adminDepartments.map(dept => ({
        id: dept.id,
        parentId: dept.parentDeptId || null
      }));

      const positions = layoutTree(parentChildPairs, 480, 380);

      const initialNodes: Node[] = adminDepartments.map(dept => {
        const pos = positions[dept.id] || { x: 0, y: 0 };
        const manager = employees.find(e => e.id === dept.managerId);
        const employeeCount = employees.filter(e => e.departmentId === dept.id).length;

        return {
          id: dept.id,
          type: 'department',
          position: pos,
          data: { 
            department: dept,
            managerName: manager?.name,
            employeeCount: employeeCount
          },
        };
      });

      const initialEdges: Edge[] = adminDepartments
        .filter(dept => dept.parentDeptId && adminDepartments.some(d => d.id === dept.parentDeptId))
        .map(dept => ({
          id: `e-${dept.parentDeptId}-${dept.id}`,
          source: dept.parentDeptId!,
          target: dept.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#10b981', strokeWidth: 4 }, // High contrast clean lines
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 25,
            height: 25,
            color: '#10b981',
          },
        }));

      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [employees, adminDepartments, viewMode, systemSettings, primaryColor]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(async (params: Connection) => {
    if (!params.source || !params.target) return;
    if (params.source === params.target) return;

    if (viewMode === 'employees') {
      // Check for circular dependency
      const checkCircular = (targetId: string, sourceId: string): boolean => {
        const parent = employees.find(e => e.id === sourceId);
        if (!parent) return false;
        if (parent.managerId === targetId) return true;
        if (parent.managerId) return checkCircular(targetId, parent.managerId);
        return false;
      };

      if (checkCircular(params.target, params.source)) {
        alert(isRtl ? 'خطأ: لا يمكن إنشاء علاقة دائرية (الموظف لا يمكن أن يكون مديراً لمديره)' : 'Error: Circular dependency is not allowed (an employee cannot report to their subordinate)');
        return;
      }

      // Update internal state immediately for responsiveness
      setEdges((eds) => addEdge({ 
        ...params, 
        animated: true, 
        style: { stroke: primaryColor, strokeWidth: 4 }, 
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 25,
          height: 25,
          color: primaryColor,
        },
      }, eds));

      // PERSIST TO FIRESTORE
      try {
        const subordinateId = params.target;
        const managerId = params.source;
        const employee = employees.find(e => e.id === subordinateId);
        if (employee) {
          await updateDoc(doc(db, 'employees', subordinateId), {
            ...employee,
            managerId: managerId
          });
          await refreshData();
        }
      } catch (error) {
        console.error("Error updating manager structure:", error);
        alert(isRtl ? 'حدث خطأ أثناء تحديث الهيكل التنظيمي' : 'Error updating reporting structure');
      }
    } else {
      // Department circular check
      const checkCircular = (targetId: string, sourceId: string): boolean => {
        const parent = adminDepartments.find(d => d.id === sourceId);
        if (!parent) return false;
        if (parent.parentDeptId === targetId) return true;
        if (parent.parentDeptId) return checkCircular(targetId, parent.parentDeptId);
        return false;
      };

      if (checkCircular(params.target, params.source)) {
        alert(isRtl ? 'خطأ: لا يمكن إنشاء علاقة دائرية بين الأقسام' : 'Error: Circular dependency between departments is not allowed');
        return;
      }

      // Update UI immediately
      setEdges((eds) => addEdge({ 
        ...params, 
        animated: true, 
        style: { stroke: '#10b981', strokeWidth: 4 }, 
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 25,
          height: 25,
          color: '#10b981',
        },
      }, eds));

      // PERSIST TO FIRESTORE
      try {
        const childDeptId = params.target;
        const parentDeptId = params.source;
        const childDept = adminDepartments.find(d => d.id === childDeptId);
        if (childDept) {
          await updateDoc(doc(db, 'adminDepartments', childDeptId), {
            ...childDept,
            parentDeptId: parentDeptId
          });
          await refreshData();
        }
      } catch (error) {
        console.error("Error updating department parent:", error);
        alert(isRtl ? 'حدث خطأ أثناء تحديث الهيكل الإداري' : 'Error updating department structure');
      }
    }
  }, [employees, adminDepartments, viewMode, isRtl, refreshData]);

  return (
    <div className="space-y-6">
      {/* View Selector Controls */}
      <div className="bg-card border border-border p-2 rounded-none flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('employees')}
            className={cn(
              "px-5 py-3 text-sm font-black transition-all flex items-center gap-2.5 rounded-none cursor-pointer",
              viewMode === 'employees'
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Users className="w-4 h-4" />
            {isRtl ? "هيكل الموظفين المباشر" : "Direct Employee reporting"}
          </button>
          
          <button
            onClick={() => setViewMode('departments')}
            className={cn(
              "px-5 py-3 text-sm font-black transition-all flex items-center gap-2.5 rounded-none cursor-pointer",
              viewMode === 'departments'
                ? "bg-emerald-600 text-white shadow-md"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Network className="w-4 h-4" />
            {isRtl ? "الهيكل الإداري (الأقسام)" : "Administrative Structure (Departments)"}
          </button>
        </div>

        <div className="text-xs font-bold text-muted-foreground px-4 hidden md:block">
          {viewMode === 'employees' 
            ? (isRtl ? "مخطط التبعية المباشرة للموظفين" : "Direct subordination hierarchy")
            : (isRtl ? "مُخطط الهيكل التنظيمي والترابط التلقائي للأقسام" : "Departmental reporting flow")
          }
        </div>
      </div>

      <div className="bg-primary/10 border border-primary/20 p-4 rounded-none flex items-start gap-3">
        <AlertCircle className={cn("w-5 h-5 mt-0.5 shrink-0", viewMode === 'employees' ? "text-primary" : "text-emerald-500")} />
        <div className="text-sm">
          <p className={cn("font-black mb-1 uppercase tracking-tighter", viewMode === 'employees' ? "text-primary" : "text-emerald-600")}>
            {t('تعليمات التحكم بالهيكل:')}
          </p>
          <ul className="text-muted-foreground font-bold space-y-1 list-disc list-inside">
            {viewMode === 'employees' ? (
              <>
                <li>{t('قم بسحب الخط من أسفل بطاقة المدير إلى أعلى بطاقة الموظف لتعيين مدير جديد.')}</li>
                <li>{t('يمكنك تحريك البطاقات لتنظيم الشكل كما تراه مناسباً.')}</li>
                <li>{t('يتم حفظ التغييرات تلقائياً في ملف الموظف بمجرد التوصيل.')}</li>
              </>
            ) : (
              <>
                <li>{isRtl ? "يتم استيراد كافة الأقسام الإدارية المعرفة في (الهيكل الإداري) وموضعها تلقائياً." : "All departments configured in the administrative structure are fully loaded and auto-placed."}</li>
                <li>{isRtl ? "قم بسحب الخط من أسفل بطاقة القسم الأعلى إلى أعلى بطاقة القسم التابع لربطه به إدارياً تلقائياً." : "Drag from the bottom of a parent department to the top of a child department to link them administratively."}</li>
                <li>{isRtl ? "يساعد التقسيم في تتبع أداء العاملين وإصدار كشوف المرتبات المخصصة لكل قسم." : "Structuring departments enables accurate multi-level payroll and department analysis."}</li>
              </>
            )}
          </ul>
        </div>
      </div>

      <div className="h-[700px] bg-card rounded-none border border-border shadow-sm relative overflow-hidden rtl" dir="ltr">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-muted/30"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="currentColor" className="opacity-10" />
          <Controls className="bg-card border-border fill-foreground text-foreground" />
        </ReactFlow>
      </div>
    </div>
  );
};
