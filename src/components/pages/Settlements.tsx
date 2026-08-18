import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Download,
  Filter,
  FileSpreadsheet,
  Building2,
  MapPin,
  Briefcase,
  Globe,
  Settings2
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { Employee, EmployeeStatus, PaymentMethod } from '../../types';
import { cn, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useLanguage } from '../../contexts/LanguageContext';

const getSafeAllowances = (allowances: any): any[] => {
  if (Array.isArray(allowances)) return allowances;
  if (typeof allowances === 'string') {
    try {
      const parsed = JSON.parse(allowances);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const Settlements: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { employees } = useData();
  const [filters, setFilters] = useState({
    searchTerm: '',
    nationality: 'all',
    workType: 'all',
    status: 'all',
    paymentMethod: 'all',
    jobTitle: 'all'
  });

  const filterOptions = useMemo(() => {
    const nationalities = Array.from(new Set(employees.map(e => e.nationality).filter(Boolean)));
    const workTypes = Array.from(new Set(employees.map(e => e.workType).filter(Boolean)));
    const jobs = Array.from(new Set(employees.map(e => e.jobTitle).filter(Boolean)));
    
    return { nationalities, workTypes, jobs };
  }, [employees]);

  const filteredData = useMemo(() => {
    return employees.filter(e => {
      const matchSearch = (e.name || '').toLowerCase().includes(filters.searchTerm.toLowerCase()) || 
                          (e.employeeId || '').includes(filters.searchTerm);
      const matchNationality = filters.nationality === 'all' || e.nationality === filters.nationality;
      const matchWorkType = filters.workType === 'all' || e.workType === filters.workType;
      const matchStatus = filters.status === 'all' || e.status === filters.status;
      const matchMethod = filters.paymentMethod === 'all' || e.paymentMethod === filters.paymentMethod;
      const matchJob = filters.jobTitle === 'all' || e.jobTitle === filters.jobTitle;

      return matchSearch && matchNationality && matchWorkType && 
             matchStatus && matchMethod && matchJob;
    });
  }, [employees, filters]);

  const totals = useMemo(() => {
    return filteredData.reduce((acc, current) => {
      const allowances = getSafeAllowances(current.allowances).reduce((sum, a) => sum + a.amount, 0);
      const gross = current.basicSalary + current.housingAllowance + current.transportAllowance + 
                    current.subsistenceAllowance + current.otherAllowances + 
                    current.mobileAllowance + current.managementAllowance + allowances;
      
      return {
        basic: acc.basic + (current.basicSalary || 0),
        housing: acc.housing + (current.housingAllowance || 0),
        allowances: acc.allowances + (gross - current.basicSalary - current.housingAllowance),
        gross: acc.gross + gross,
        count: acc.count + 1
      };
    }, { basic: 0, housing: 0, allowances: 0, gross: 0, count: 0 });
  }, [filteredData]);

  const handleExportExcel = () => {
    const data = filteredData.map(e => {
      const otherAllowances = getSafeAllowances(e.allowances).reduce((sum, a) => sum + a.amount, 0);
      const totalAllowances = e.transportAllowance + e.subsistenceAllowance + e.otherAllowances + 
                             e.mobileAllowance + e.managementAllowance + otherAllowances;
      const gross = e.basicSalary + e.housingAllowance + totalAllowances;
      
      return {
        [t('الرقم الوظيفي')]: e.employeeId,
        [t('الاسم')]: e.name,
        [t('الجنسية')]: e.nationality,
        [t('المسمى الوظيفي')]: e.jobTitle,
        [t('نوع الدوام')]: e.workType === 'Part time' ? t('دوام جزئي') : t('تفرغ كامل'),
        [t('الحالة')]: e.status === 'Active' ? t('نشط') : e.status === 'End of Service' ? t('إنهاء خدمات') : e.status === 'Leave' ? t('إجازة') : t('غير نشط'),
        [t('طريقة الاستلام')]: e.paymentMethod === 'Bank' ? t('بنك') : t('نقدي'),
        [t('الراتب الأساسي')]: e.basicSalary,
        [t('بدل السكن')]: e.housingAllowance,
        [t('إجمالي البدلات الأخرى')]: totalAllowances,
        [t('إجمالي الراتب')]: gross
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, t('التقرير المفلتر'));
    XLSX.writeFile(wb, `Report_Filtered_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Search & Main Filter Card */}
      <div className="bg-card p-8 rounded-[2.5rem] border border-border shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-8">
          <div className="space-y-1">
            <h3 className="text-2xl font-black text-foreground flex items-center gap-3">
              <Filter className="w-7 h-7 text-primary" />{t('تصفية البيانات (Filtration)')}</h3>
            <p className="text-muted-foreground font-medium">{t('استخرج تقارير مخصصة بناءً على كافة بيانات الموظفين')}</p>
          </div>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-200"
          >
            <Download className="w-5 h-5" />{t('تصدير البيانات المفلترة')}</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground mr-2 flex items-center gap-2">
              <Search className="w-3 h-3" />{t('بحث عام')}</label>
            <input 
              type="text" 
              placeholder={t('الاسم أو الرقم الوظيفي...')}
              className="w-full px-5 py-3 bg-muted border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
              value={filters.searchTerm}
              onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground mr-2 flex items-center gap-2">
              <Globe className="w-3 h-3" />{t('الجنسية')}</label>
            <select 
              className="w-full px-5 py-3 bg-muted border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
              value={filters.nationality}
              onChange={(e) => setFilters({...filters, nationality: e.target.value})}
            >
              <option value="all">{t('الكل')}</option>
              {filterOptions.nationalities.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground mr-2 flex items-center gap-2">
              <MapPin className="w-3 h-3" />{t('نوع الدوام')}</label>
            <select 
              className="w-full px-5 py-3 bg-muted border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
              value={filters.workType}
              onChange={(e) => setFilters({...filters, workType: e.target.value})}
            >
              <option value="all">{t('الكل')}</option>
              {filterOptions.workTypes.map(opt => <option key={opt} value={opt}>{opt === 'Part time' ? t('دوام جزئي') : t('تفرغ كامل')}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground mr-2 flex items-center gap-2">
              <Briefcase className="w-3 h-3" />{t('المسمى الوظيفي')}</label>
            <select 
              className="w-full px-5 py-3 bg-muted border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
              value={filters.jobTitle}
              onChange={(e) => setFilters({...filters, jobTitle: e.target.value})}
            >
              <option value="all">{t('الكل')}</option>
              {filterOptions.jobs.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground mr-2 flex items-center gap-2">
              <Settings2 className="w-3 h-3" />{t('الحالة')}</label>
            <select 
              className="w-full px-5 py-3 bg-muted border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="all">{t('الكل')}</option>
              <option value="Active">{t('نشط')}</option>
              <option value="Inactive">{t('غير نشط')}</option>
              <option value="End of Service">{t('إنهاء خدمات')}</option>
              <option value="Leave">{t('إجازة')}</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-muted-foreground mr-2 flex items-center gap-2">
              <Settings2 className="w-3 h-3" />{t('طريقة الاستلام')}</label>
            <select 
              className="w-full px-5 py-3 bg-muted border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
              value={filters.paymentMethod}
              onChange={(e) => setFilters({...filters, paymentMethod: e.target.value})}
            >
              <option value="all">{t('الكل')}</option>
              <option value="Bank">{t('استلام بنك')}</option>
              <option value="Cash">{t('استلام راتب')}</option>
            </select>
          </div>

          <div className="flex items-end">
            <button 
              onClick={() => setFilters({
                searchTerm: '',
                nationality: 'all',
                workType: 'all',
                status: 'all',
                paymentMethod: 'all',
                jobTitle: 'all'
              })}
              className="text-sm font-black text-primary hover:text-primary/80 p-3 h-12 flex items-center gap-2"
            >
              <Users className="w-4 h-4" />{t('إعادة تعيين الفلاتر')}</button>
          </div>
        </div>
      </div>

      {/* Summary Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm">
          <p className="text-sm font-bold text-muted-foreground mb-1 leading-none">{t('عدد الموظفين المفلتر')}</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-foreground leading-none">{totals.count}</p>
            <Users className="w-8 h-8 text-primary/10" />
          </div>
        </div>
        <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm">
          <p className="text-sm font-bold text-emerald-600 mb-1 leading-none">{t('إجمالي الراتب الأساسي')}</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-foreground leading-none">{formatCurrency(totals.basic)}</p>
            <Building2 className="w-8 h-8 text-emerald-500/10" />
          </div>
        </div>
        <div className="bg-card p-6 rounded-[2rem] border border-border shadow-sm">
          <p className="text-sm font-bold text-primary mb-1 leading-none">{t('إجمالي البدلات')}</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-foreground leading-none">{formatCurrency(totals.allowances + totals.housing)}</p>
            <FileSpreadsheet className="w-8 h-8 text-primary/10" />
          </div>
        </div>
        <div className="bg-primary/5 p-6 rounded-[2rem] border border-primary/20 shadow-sm">
          <p className="text-sm font-bold text-primary mb-1 leading-none">{t('إجمالي الرواتب المفلترة')}</p>
          <div className="flex items-end justify-between">
            <p className="text-3xl font-black text-primary leading-none">{formatCurrency(totals.gross)}</p>
            <Download className="w-8 h-8 text-primary/20" />
          </div>
        </div>
      </div>

      {/* Result Table */}
      <div className="bg-card rounded-[2.5rem] border border-border shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-right">
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className="px-8 py-5 text-sm font-black text-muted-foreground">{t('الموظف')}</th>
              <th className="px-8 py-5 text-sm font-black text-muted-foreground">{t('نوع الدوام')}</th>
              <th className="px-8 py-5 text-sm font-black text-muted-foreground">{t('المسمى الوظيفي')}</th>
              <th className="px-8 py-5 text-sm font-black text-muted-foreground">{t('الحالة')}</th>
              <th className="px-8 py-5 text-sm font-black text-muted-foreground">{t('الأساسي')}</th>
              <th className="px-8 py-5 text-sm font-black text-muted-foreground">{t('البدلات')}</th>
              <th className="px-8 py-5 text-sm font-black text-muted-foreground text-left">{t('الإجمالي')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredData.map(e => {
              const otherAllowances = getSafeAllowances(e.allowances).reduce((sum, a) => sum + a.amount, 0);
              const totalAllowances = e.housingAllowance + e.transportAllowance + e.subsistenceAllowance + 
                                     e.otherAllowances + e.mobileAllowance + e.managementAllowance + otherAllowances;
              return (
                <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center font-bold text-primary">
                        {e.name[0]}
                      </div>
                      <div>
                        <p className="font-bold text-foreground">{e.name}</p>
                        <p className="text-xs text-muted-foreground">#{e.employeeId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-muted-foreground">{e.workType === 'Part time' ? t('دوام جزئي') : t('تفرغ كامل')}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-muted-foreground">{e.jobTitle || t('غير محدد')}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-3 py-1 rounded-lg text-xs font-black",
                      e.status === 'Active' ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
                    )}>
                      {e.status === 'Active' ? t('نشط') : t('غير نشط')}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-sm font-bold text-foreground">{formatCurrency(e.basicSalary)}</td>
                  <td className="px-8 py-5 text-sm font-bold text-foreground">{formatCurrency(totalAllowances)}</td>
                  <td className="px-8 py-5 text-sm font-black text-primary text-left">{formatCurrency(e.basicSalary + totalAllowances)}</td>
                </tr>
              );
            })}
            {filteredData.length === 0 && (
              <tr>
                <td colSpan={7} className="px-8 py-20 text-center">
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                  <p className="text-muted-foreground font-bold">{t('لا يوجد نتائج تطابق الفلاتر المختارة')}</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
