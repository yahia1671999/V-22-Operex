import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, FileText, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';

export const HRDashboard: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { employees, missions } = useData();

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const activeMissions = missions.filter(m => m.status === 'Approved').length;
  const todayMissions = missions.filter(m => {
    const today = new Date().toISOString().split('T')[0];
    return m.startDate <= today && m.endDate >= today && m.status === 'Approved';
  }).length;

  const stats = useMemo(() => [
    { label: t('إجمالي الموظفين'), value: totalEmployees, icon: Users, color: 'blue' },
    { label: t('الموظفين النشطين'), value: activeEmployees, icon: ShieldCheck, color: 'emerald' },
    { label: t('المأموريات الكلية'), value: activeMissions, icon: FileText, color: 'indigo' },
    { label: t('مأموريات اليوم'), value: todayMissions, icon: CheckCircle2, color: 'orange' },
  ], [totalEmployees, activeEmployees, activeMissions, todayMissions]);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-6 bg-card p-8 rounded-none border-2 border-primary shadow-[8px_8px_0px_0px_rgba(37,99,235,0.1)]">
        <motion.div 
          className="w-16 h-16 bg-emerald-500 rounded-none flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white cursor-pointer select-none"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
          whileHover={{ scale: 1.15, rotate: 12, transition: { type: "spring", stiffness: 300 } }}
          whileTap={{ scale: 0.95 }}
        >
          <Users className="w-8 h-8" />
        </motion.div>
        <div>
          <h1 className="text-3xl font-black heading-gradient uppercase tracking-widest leading-none">{t('لوحة تحكم الموارد البشرية')}</h1>
          <div className="h-0.5 w-24 bg-primary mt-2" />
          <p className="text-muted-foreground font-bold mt-2 uppercase text-xs tracking-tighter">{t('نظرة عامة شاملة على السجلات والسلوك الوظيفي')}</p>
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
                stat.color === 'emerald' ? "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white" :
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
      
      <div className="bg-card p-10 rounded-none border-2 border-border shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)]">
        <h3 className="text-xl font-black text-foreground mb-8 flex items-center gap-3">
          <div className="w-1.5 h-6 bg-primary" />{t('المأموريات النشطة ميدانياً')}</h3>
        {todayMissions > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {missions.filter(m => {
              const today = new Date().toISOString().split('T')[0];
              return m.startDate <= today && m.endDate >= today && m.status === 'Approved';
            }).map((m) => {
              const emp = employees.find(e => e.id === m.employeeId);
              return (
                <div key={m.id} className="flex items-center gap-4 p-6 border-2 border-border/60 rounded-none bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="w-12 h-12 bg-primary rounded-none flex items-center justify-center font-black text-primary-foreground shadow-md">
                    {emp?.name?.[0] || 'U'}
                  </div>
                  <div>
                    <h4 className="font-black text-foreground uppercase tracking-tight">{emp?.name || t('غير معروف')}</h4>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">تاريخ العودة: {m.endDate}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-20 border-2 border-dashed border-border/40">
             <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-20" />
             <p className="text-muted-foreground font-black uppercase tracking-widest text-sm">{t('لا توجد مأموريات نشطة حالياً')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
