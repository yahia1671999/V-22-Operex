import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, ListTodo, CheckCircle2, Clock } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export const OperationsDashboard: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { projects, projectTasks } = useData();

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'Active').length;
  
  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter(t => t.status === 'Executed' || t.status === 'Approved').length;

  const stats = useMemo(() => [
    { label: t('إجمالي المشاريع'), value: totalProjects, icon: Briefcase, color: 'blue' },
    { label: t('المشاريع النشطة'), value: activeProjects, icon: Clock, color: 'indigo' },
    { label: t('إجمالي المهام'), value: totalTasks, icon: ListTodo, color: 'orange' },
    { label: t('المهام المنجزة'), value: completedTasks, icon: CheckCircle2, color: 'green' },
  ], [totalProjects, activeProjects, totalTasks, completedTasks]);

  const taskStatusData = useMemo(() => {
    const statuses = ['Pending', 'In Progress', 'Under Review', 'Approved', 'Executed', 'Rejected'];
    return statuses.map(status => ({
      name: status === 'Pending' ? t('قيد الانتظار') :
            status === 'In Progress' ? t('قيد التنفيذ') :
            status === 'Under Review' ? t('قيد المراجعة') :
            status === 'Approved' ? t('مقبولة') :
            status === 'Executed' ? t('منفذة') : t('مرفوضة'),
      count: projectTasks.filter(t => t.status === status).length
    }));
  }, [projectTasks]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-6 bg-card p-8 rounded-none border-2 border-primary shadow-[8px_8px_0px_0px_rgba(37,99,235,0.1)]">
        <motion.div 
          className="w-16 h-16 bg-indigo-600 rounded-none flex items-center justify-center shadow-lg shadow-indigo-600/20 text-white cursor-pointer select-none"
          whileHover={{ scale: 1.15, rotate: 360, transition: { duration: 0.6, ease: "easeInOut" } }}
          whileTap={{ scale: 0.95 }}
        >
          <Briefcase className="w-8 h-8" />
        </motion.div>
        <div>
          <h1 className="text-3xl font-black heading-gradient uppercase tracking-widest leading-none">{t('لوحة تحكم التشغيل')}</h1>
          <div className="h-0.5 w-24 bg-primary mt-2" />
          <p className="text-muted-foreground font-bold mt-2 uppercase text-xs tracking-tighter tracking-widest">{t('إدارة المشاريع والمهام والإنتاجية')}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-card p-8 rounded-none border-2 border-border/80 hover:border-primary hover:shadow-[6px_6px_0px_0px_rgba(37,99,235,0.2)] transition-all group relative cursor-default">
            <div className="flex items-start justify-between mb-6">
              <div className={cn(
                "w-14 h-14 rounded-none flex items-center justify-center transition-all group-hover:scale-110",
                stat.color === 'blue' ? "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground" :
                stat.color === 'green' ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white" :
                stat.color === 'indigo' ? "bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white" :
                "bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-white"
              )}>
                <stat.icon className="w-7 h-7" />
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-muted-foreground mb-1 uppercase tracking-widest opacity-60">{stat.label}</p>
                 <h3 className="text-3xl font-black text-foreground leading-none">{stat.value}</h3>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-muted group-hover:bg-primary transition-colors" />
          </div>
        ))}
      </div>

      <div className="bg-card p-10 rounded-none border-2 border-border/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] h-[450px]">
        <h3 className="text-xl font-black text-foreground mb-8 flex items-center gap-3">
          <div className="w-1.5 h-6 bg-primary" />{t('تحليل حالة المهام')}</h3>
        <ResponsiveContainer width="100%" height="80%">
          <BarChart data={taskStatusData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 800}} dy={15} />
            <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 800}} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                borderColor: 'hsl(var(--primary))',
                borderWidth: '2px',
                borderRadius: '0px',
                color: 'hsl(var(--foreground))',
                fontWeight: '900',
                fontSize: '12px'
              }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} barSize={50} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
