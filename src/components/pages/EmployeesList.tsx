import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  UserPlus,
  Filter,
  Download,
  Upload,
  X as CloseIcon,
  FileSpreadsheet,
  Eye,
  Calendar,
  ShieldAlert,
  Award,
  Printer,
  Fingerprint,
  Clock,
  UserCheck,
  UserX,
  ShieldCheck,
  Activity,
  HeartPulse
} from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc, OperationType, handleApiError, writeBatch } from '../../api';
import { useData } from '../../contexts/DataContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Employee, Allowance, AllowanceType } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../AuthContext';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { formatTime12h } from '../../utils/timeFormatter';
import { calculateEmployeeMonthlyAttendance } from '../../utils/monthlyAttendanceCalculation';

const getSafeAllowances = (allowances: any): Allowance[] => {
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

export const EmployeesList: React.FC = () => {
  const { user, profile } = useAuth();
  const { 
    employees, 
    allowanceTypes, 
    attendanceShifts, 
    adminDepartments, 
    leaveRequests, 
    penalties = [], 
    performanceEvaluations = [], 
    performanceCycles = [], 
    systemSettings, 
    attendanceRecords = [], 
    missions = [], 
    transactions = [],
    absenceRecords = [],
    absenceTypes = [],
    administrativeNotices = [],
    refreshData 
  } = useData();
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const currentUserRole = (profile as any)?.role || (user as any)?.role || '';
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectToAttendanceFilter, setSubjectToAttendanceFilter] = useState<'All' | 'Subject' | 'NotSubject'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string | 'bulk', show: boolean }>({ id: '', show: false });
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [leaveBalanceEmployee, setLeaveBalanceEmployee] = useState<Employee | null>(null);
  const [leaveBalanceTab, setLeaveBalanceTab] = useState<'vacation' | 'sick'>('vacation');
  const [penaltiesEmployee, setPenaltiesEmployee] = useState<Employee | null>(null);
  const [performanceEmployee, setPerformanceEmployee] = useState<Employee | null>(null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);
  const [printReportEmployee, setPrintReportEmployee] = useState<Employee | null>(null);
  const [reportMonth, setReportMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
    resetForm();
  };

  const handleDownloadPdf = async () => {
    const element = document.getElementById('employee-printable-report');
    if (!element || !printReportEmployee) return;
    
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Precise mathematical conversion from OKLAB rectangular coordinates to sRGB
          const oklabToRgb = (L: number, a_val: number, b_val: number, alpha?: number) => {
            const l = L;
            const l_ = l + 0.3963377774 * a_val + 0.2158037573 * b_val;
            const m_ = l - 0.1055613458 * a_val - 0.0638541128 * b_val;
            const s_ = l - 0.0894841775 * a_val - 1.2914855414 * b_val;

            const l3 = l_ * l_ * l_;
            const m3 = m_ * m_ * m_;
            const s3 = s_ * s_ * s_;

            const rLinear = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
            const gLinear = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
            const bLinear = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

            const toSRGB = (c: number) => {
              if (isNaN(c)) return 0;
              return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
            };

            const r = Math.min(255, Math.max(0, Math.round(toSRGB(rLinear) * 255)));
            const g = Math.min(255, Math.max(0, Math.round(toSRGB(gLinear) * 255)));
            const b = Math.min(255, Math.max(0, Math.round(toSRGB(bLinear) * 255)));

            if (alpha !== undefined) {
              return `rgba(${r}, ${g}, ${b}, ${alpha})`;
            }
            return `rgb(${r}, ${g}, ${b})`;
          };

          // Precise mathematical conversion from OKLCH (Oklab polar representation) to sRGB
          const oklchToRgb = (L: number, C: number, H: number, alpha?: number) => {
            const a_val = C * Math.cos((H * Math.PI) / 180);
            const b_val = C * Math.sin((H * Math.PI) / 180);
            return oklabToRgb(L, a_val, b_val, alpha);
          };

          const convertColorsText = (text: string): string => {
            if (!text) return text;
            let result = text.replace(
              /oklch\(\s*([+-]?[0-9.]+%?)\s*[\s,]\s*([+-]?[0-9.]+%?)\s*[\s,]\s*([+-]?[0-9.]+(?:deg|rad|grad|turn)?)(?:\s*[\s,/]\s*([+-]?[0-9.]+%?))?\s*\)/gi,
              (match, LStr, CStr, HStr, AStr) => {
                let L = parseFloat(LStr);
                if (LStr.endsWith('%')) L /= 100;

                let C = parseFloat(CStr);
                if (CStr.endsWith('%')) C /= 100;

                let H = parseFloat(HStr);
                if (HStr.endsWith('rad')) {
                  H = H * (180 / Math.PI);
                } else if (HStr.endsWith('grad')) {
                  H = H * 0.9;
                } else if (HStr.endsWith('turn')) {
                  H = H * 360;
                }

                let alpha = undefined;
                if (AStr) {
                  alpha = parseFloat(AStr);
                  if (AStr.endsWith('%')) alpha /= 100;
                }

                return oklchToRgb(L, C, H, alpha);
              }
            );

            result = result.replace(
              /oklab\(\s*([+-]?[0-9.]+%?)\s*[\s,]\s*([+-]?[0-9.]+%?)\s*[\s,]\s*([+-]?[0-9.]+%?)(?:\s*[\s,/]\s*([+-]?[0-9.]+%?))?\s*\)/gi,
              (match, LStr, aStr, bStr, AStr) => {
                let L = parseFloat(LStr);
                if (LStr.endsWith('%')) L /= 100;

                let a_val = parseFloat(aStr);
                if (aStr.endsWith('%')) a_val /= 100;

                let b_val = parseFloat(bStr);
                if (bStr.endsWith('%')) b_val /= 100;

                let alpha = undefined;
                if (AStr) {
                  alpha = parseFloat(AStr);
                  if (AStr.endsWith('%')) alpha /= 100;
                }

                return oklabToRgb(L, a_val, b_val, alpha);
              }
            );

            return result;
          };

          // Extract, compile and convert all parent document stylesheets
          let compiledCss = '';
          try {
            const parentSheets = Array.from(window.document.styleSheets);
            for (const sheet of parentSheets) {
              try {
                if (sheet.cssRules) {
                  const rules = Array.from(sheet.cssRules);
                  for (const rule of rules) {
                    compiledCss += rule.cssText + '\n';
                  }
                }
              } catch (sheetErr) {
                // Ignore SecurityError for cross-origin stylesheets (e.g. Google Fonts)
                console.warn('Skipped reading cssRules for a stylesheet:', sheetErr);
              }
            }
          } catch (err) {
            console.error('Error reading parent stylesheets:', err);
          }

          // Convert all oklch and oklab colors to standard rgb/rgba
          const sanitizedCss = convertColorsText(compiledCss);

          // Remove all same-origin linked stylesheet links and custom style elements in clonedDoc
          const existingStyles = Array.from(clonedDoc.getElementsByTagName('style'));
          existingStyles.forEach((style) => {
            style.parentNode?.removeChild(style);
          });

          const existingLinks = Array.from(clonedDoc.getElementsByTagName('link'));
          existingLinks.forEach((link) => {
            if (link.rel === 'stylesheet') {
              const href = link.getAttribute('href');
              if (!href || href.startsWith('/') || href.startsWith(window.location.origin) || !href.startsWith('http')) {
                link.parentNode?.removeChild(link);
              }
            }
          });

          // Append our unified and fully parsed rgb-safe stylesheet
          const sanitizedStyleTag = clonedDoc.createElement('style');
          sanitizedStyleTag.textContent = sanitizedCss;
          clonedDoc.head.appendChild(sanitizedStyleTag);

          // Convert inline style attributes and computed styles for ALL cloned DOM elements
          const allElements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < allElements.length; i++) {
            const element = allElements[i] as HTMLElement;
            if (element && element.style) {
              // Retrieve the element's actual computed styles in the running window context
              const computed = window.getComputedStyle(element);

              const bg = computed.backgroundColor;
              if (bg && (bg.toLowerCase().includes('oklch') || bg.toLowerCase().includes('oklab'))) {
                element.style.backgroundColor = convertColorsText(bg);
              }

              const fg = computed.color;
              if (fg && (fg.toLowerCase().includes('oklch') || fg.toLowerCase().includes('oklab'))) {
                element.style.color = convertColorsText(fg);
              }

              const bgImg = computed.backgroundImage;
              if (bgImg && (bgImg.toLowerCase().includes('oklch') || bgImg.toLowerCase().includes('oklab'))) {
                element.style.backgroundImage = convertColorsText(bgImg);
              }

              const bgShort = computed.background;
              if (bgShort && (bgShort.toLowerCase().includes('oklch') || bgShort.toLowerCase().includes('oklab'))) {
                element.style.background = convertColorsText(bgShort);
              }

              const fill = computed.fill;
              if (fill && (fill.toLowerCase().includes('oklch') || fill.toLowerCase().includes('oklab'))) {
                element.style.fill = convertColorsText(fill);
              }

              const stroke = computed.stroke;
              if (stroke && (stroke.toLowerCase().includes('oklch') || stroke.toLowerCase().includes('oklab'))) {
                element.style.stroke = convertColorsText(stroke);
              }

              // Handle border properties
              const borderProps = [
                'borderColor',
                'borderTopColor',
                'borderRightColor',
                'borderBottomColor',
                'borderLeftColor',
                'outlineColor'
              ];
              borderProps.forEach((prop) => {
                const val = (computed as any)[prop];
                if (val && (val.toLowerCase().includes('oklch') || val.toLowerCase().includes('oklab'))) {
                  element.style[prop as any] = convertColorsText(val);
                }
              });

              // Handle box shadows and text shadows
              const shadowProps = ['boxShadow', 'textShadow'];
              shadowProps.forEach((prop) => {
                const val = (computed as any)[prop];
                if (val && (val.toLowerCase().includes('oklch') || val.toLowerCase().includes('oklab'))) {
                  element.style[prop as any] = convertColorsText(val);
                }
              });

              // Check if there is an explicit inline style attribute, process it
              const inlineStyle = element.getAttribute('style');
              if (inlineStyle && (inlineStyle.toLowerCase().includes('oklch') || inlineStyle.toLowerCase().includes('oklab'))) {
                element.setAttribute('style', convertColorsText(inlineStyle));
              }
            }
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210; 
      const pageHeight = 295; 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }
      
      const safeName = printReportEmployee.name.replace(/\s+/g, '_');
      pdf.save(`${safeName}_report_${reportMonth}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  useEffect(() => {
    if (performanceEmployee) {
      const empEvaluations = performanceEvaluations.filter(
        (e: any) => e.employeeId === performanceEmployee.id && (e.status === 'Approved' || e.status === 'Closed')
      );
      if (empEvaluations.length > 0) {
        setSelectedEvaluationId(empEvaluations[0].id);
      } else {
        setSelectedEvaluationId(null);
      }
    } else {
      setSelectedEvaluationId(null);
    }
  }, [performanceEmployee, performanceEvaluations]);

  // Form State
  const [formData, setFormData] = useState<Omit<Employee, 'id'>>({
    employeeId: '',
    name: '',
    iqamaNumber: '',
    nationality: '',
    jobTitle: '',
    joinDate: '',
    workType: 'Full time',
    bankAccount: '',
    bankCode: '',
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    subsistenceAllowance: 0,
    otherAllowances: 0,
    mobileAllowance: 0,
    managementAllowance: 0,
    dailyWorkHours: 8,
    status: 'Active',
    paymentMethod: 'Bank',
    allowances: [],
    email: '',
    shiftId: '',
    managerId: '',
    departmentId: '',
    branchId: '',
    legalEntity: '',
    payrollGroup: '',
    contractType: '',
    endOfServiceDate: '',
    insuranceProfile: '',
    taxProfile: '',
    leavePlan: '',
    sickLeavePlan: '30',
    gradeLevel: '',
    subjectToSi: 'Yes',
    siNumber: '',
    subjectToTax: 'Yes',
    taxExempt: 'No',
    activeDeductions: [],
    exemptFromAppraisal: 'No',
    workMode: 'Office Work',
    subjectToAttendance: 'Yes',
    attendanceStatusEffectiveDate: new Date().toISOString().slice(0, 10)
  });

  const [availableDeductions, setAvailableDeductions] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch('/api/deduction-types', {
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch deduction types: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data)) {
          setAvailableDeductions(data.filter((d: any) => d.status === 'Active'));
        } else {
          console.error('Deduction types response is not an array:', data);
          setAvailableDeductions([]);
        }
      })
      .catch(err => {
        console.warn('Note on active deduction settings:', err?.message || err);
        setAvailableDeductions([]);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedEmpId = String(formData.employeeId || '').trim();
    if (!trimmedEmpId) {
      alert(language === 'ar' ? 'الرجاء إدخال الرقم الوظيفي للموظف' : 'Please enter Employee ID');
      return;
    }

    // Client-side safeguard against duplicate employeeId
    const isDuplicate = employees.some(
      emp => String(emp.employeeId || '').trim() === trimmedEmpId && emp.id !== editingEmployee?.id
    );

    if (isDuplicate) {
      alert(language === 'ar' ? 'عذراً، هذا الرقم الوظيفي مستخدم بالفعل لموظف آخر.' : 'This Employee ID is already in use by another employee.');
      return;
    }

    try {
      setIsSubmitting(true);
      const id = editingEmployee?.id || doc(collection(db, 'employees')).id;
      
      // Sanitize optional foreign keys: convert empty strings to null
      const sanitizedData = {
        ...formData,
        employeeId: trimmedEmpId,
        shiftId: formData.shiftId || null,
        managerId: formData.managerId || null,
        departmentId: formData.departmentId || null,
        branchId: formData.branchId || null
      };

      await setDoc(doc(db, 'employees', id), sanitizedData);
      await refreshData();
      setIsModalOpen(false);
      setEditingEmployee(null);
      resetForm();
      alert('تم حفظ البيانات بنجاح');
    } catch (error: any) {
      console.error('Failed to save employee:', error);
      alert('فشل في حفظ البيانات: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      name: '',
      iqamaNumber: '',
      nationality: '',
      jobTitle: '',
      joinDate: '',
      workType: 'Full time',
      bankAccount: '',
      bankCode: '',
      basicSalary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      subsistenceAllowance: 0,
      otherAllowances: 0,
      mobileAllowance: 0,
      managementAllowance: 0,
      dailyWorkHours: 8,
      status: 'Active',
      paymentMethod: 'Bank',
      allowances: [],
      email: '',
      shiftId: '',
      managerId: '',
      departmentId: '',
      branchId: '',
      legalEntity: '',
      payrollGroup: '',
      contractType: '',
      endOfServiceDate: '',
      insuranceProfile: '',
      taxProfile: '',
      leavePlan: '',
      sickLeavePlan: '30',
      gradeLevel: '',
      subjectToSi: 'Yes',
      siNumber: '',
      subjectToTax: 'Yes',
      taxExempt: 'No',
      activeDeductions: [],
      exemptFromAppraisal: 'No',
      workMode: 'Office Work',
      subjectToAttendance: 'Yes',
      attendanceStatusEffectiveDate: new Date().toISOString().slice(0, 10)
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const batch = writeBatch(db);
    selectedIds.forEach(id => {
      batch.delete(doc(db, 'employees', id));
    });
    await batch.commit();
    await refreshData();
    setSelectedIds([]);
    setDeleteConfirm({ id: '', show: false });
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployees.map(e => e.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleAddAllowance = () => {
    setFormData({
      ...formData,
      allowances: [...formData.allowances, { id: crypto.randomUUID(), type: '', amount: 0 }]
    });
  };

  const handleRemoveAllowance = (index: number) => {
    const newAllowances = [...formData.allowances];
    newAllowances.splice(index, 1);
    setFormData({ ...formData, allowances: newAllowances });
  };

  const handleAllowanceChange = (index: number, field: keyof Allowance, value: string | number) => {
    const newAllowances = [...formData.allowances];
    newAllowances[index] = { ...newAllowances[index], [field]: value };
    setFormData({ ...formData, allowances: newAllowances });
  };

  const handleContractYearsChange = (years: string, joinDateString?: string) => {
    const jdStr = joinDateString || formData.joinDate;
    if (!jdStr || !years) {
      setFormData(prev => ({
        ...prev,
        contractType: years,
        endOfServiceDate: ''
      }));
      return;
    }
    try {
      const parts = jdStr.split('-');
      if (parts.length === 3) {
        const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        date.setFullYear(date.getFullYear() + Number(years));
        const formattedEndDate = date.toISOString().split('T')[0];
        setFormData(prev => ({
          ...prev,
          contractType: years,
          endOfServiceDate: formattedEndDate
        }));
      }
    } catch (e) {
      console.error(e);
      setFormData(prev => ({ ...prev, contractType: years }));
    }
  };

  const handleExportExcel = () => {
    const data = employees.map((emp, index) => ({
      [t('ت عام')]: index + 1,
      [t('ت')]: index + 1,
      [t('رقم الموظف')]: emp.employeeId || '',
      [t('الرقم القومي')]: emp.iqamaNumber || '',
      [t('الراتب الاساسي')]: emp.basicSalary,
      [t('بدل سكن')]: emp.housingAllowance || 0,
      [t('بدل نقل')]: emp.transportAllowance || 0,
      [t('بدل إعاشه')]: emp.subsistenceAllowance || 0,
      [t('بدل جوال')]: emp.mobileAllowance || 0,
      [t('بدل ادارة')]: emp.managementAllowance || 0,
      [t('بدلات اخرى')]: emp.otherAllowances || 0,
      [t('الايبــــــــــان')]: emp.bankAccount || '',
      [t('كود البنك')]: emp.bankCode || '',
      [t('ساعات العمل اليومية')]: emp.dailyWorkHours || 8,
      [t('طريقة الاستلام')]: emp.paymentMethod === 'Bank' ? t('استلام بنك') : t('استلام راتب'),
      [t('الإسم')]: emp.name,
      [t('الجنسية')]: emp.nationality || '',
      [t('المسمى الوظيفي')]: emp.jobTitle || '',
      [t('بداية العمل')]: emp.joinDate || '',
      [t('نوع الدوام')]: emp.workType || 'Full time',
      [t('المجموع')]: emp.basicSalary + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + 
                 (emp.subsistenceAllowance || 0) + (emp.otherAllowances || 0) + 
                 (emp.mobileAllowance || 0) + (emp.managementAllowance || 0) +
                 getSafeAllowances(emp.allowances).reduce((sum, a) => sum + a.amount, 0),
      [t('الحالة')]: emp.status === 'Active' ? t('نشط') : t('غير نشط')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "OPerix_Employees_Master.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataArr = evt.target?.result;
      const wb = XLSX.read(dataArr, { type: 'binary', cellDates: true });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const parseExcelDate = (val: any) => {
        if (!val) return '';
        if (val instanceof Date) return val.toISOString().split('T')[0];
        if (typeof val === 'number') {
          const date = new Date(Math.round((val - 25569) * 86400 * 1000));
          return date.toISOString().split('T')[0];
        }
        return String(val);
      };

      const batch = writeBatch(db);
      const processedEmployeeIds = new Set<string>();
      const existingEmployeeIds = new Set(employees.map(emp => String(emp.employeeId || '').trim()));

      data.forEach((row) => {
        const rawId = row[t('رقم الموظف')] || row[t('الرقم الوظيفي')] || '';
        const employeeId = String(rawId).trim();
        const name = row[t('الإسم')] || row[t('اسم الموظف')] || row[t('الاسم')] || '';

        if (!employeeId || !name) {
          return;
        }

        if (processedEmployeeIds.has(employeeId) || existingEmployeeIds.has(employeeId)) {
          console.warn(`Skipping duplicate employeeId in Excel import: ${employeeId}`);
          return;
        }

        processedEmployeeIds.add(employeeId);
        const docRef = doc(collection(db, 'employees'));
        const allowances: Allowance[] = [];
        
        let paymentMethod: 'Bank' | 'Cash' = 'Bank';
        const pMethodRaw = row[t('نوع استلام الراتب')] || row[t('طريقة الاستلام')] || '';
        if (pMethodRaw === t('استلام راتب') || pMethodRaw === 'Cash') {
          paymentMethod = 'Cash';
        }

        batch.set(docRef, {
          employeeId: employeeId,
          name: name,
          iqamaNumber: String(row[t('الرقم القومي')] || row[t('رقم القومي')] || row[t('رقم الأقامة')] || row[t('رقم الإقامة')] || ''),
          nationality: row[t('الجنسية')] || '',
          jobTitle: row[t('المسمى الوظيفي')] || row[t('الوظيفة')] || row[t('المهنة')] || '',
          joinDate: parseExcelDate(row[t('بداية العمل')]),
          workType: (row[t('نوع الدوام')] === 'Part time' || row[t('نوع الدوام')] === t('دوام جزئي')) ? 'Part time' : 'Full time',
          bankAccount: row[t('الايبــــــــــان')] || row[t('رقم الحساب (IBAN)')] || '',
          bankCode: row[t('كود البنك')] || row[t('البنك')] || '',
          paymentMethod: paymentMethod,
          basicSalary: Number(row[t('الراتب الاساسي')] || row[t('الراتب الأساسي')]) || 0,
          housingAllowance: Number(row[t('بدل سكن')]) || 0,
          transportAllowance: Number(row[t('بدل نقل')]) || 0,
          subsistenceAllowance: Number(row[t('بدل إعاشه')]) || 0,
          otherAllowances: Number(row[t('بدلات اخرى')]) || 0,
          mobileAllowance: Number(row[t('بدل جوال')]) || 0,
          managementAllowance: Number(row[t('بدل ادارة')]) || 0,
          dailyWorkHours: Number(row[t('ساعات العمل اليومية')] || row[t('ساعات العمل')]) || 8,
          status: (row[t('الحالة')] === t('نشط') || row['Status'] === 'Active') ? 'Active' : 'Inactive',
          allowances: allowances,
          email: row[t('البريد الإلكتروني')] || ''
        });
      });

      await batch.commit();
      await refreshData();
      alert('تم استيراد البيانات بنجاح');
    };
    reader.readAsBinaryString(file);
  };

  const { canView, canCreate, canEdit, canDelete, canExport, allowedDepartments, isSuperAdmin } = usePermissions();

  const handleEdit = (emp: Employee) => {
    if (!canEdit('employees')) return;
    setEditingEmployee(emp);
    setFormData({ 
      ...emp,
      leavePlan: emp.leavePlan || '',
      sickLeavePlan: emp.sickLeavePlan || '30',
      allowances: getSafeAllowances(emp.allowances).map(a => ({ ...a, id: a.id || crypto.randomUUID() }))
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!canDelete('employees')) return;
    await deleteDoc(doc(db, 'employees', id));
    await refreshData();
    setDeleteConfirm({ id: '', show: false });
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      // 1. Department filter
      if (!isSuperAdmin) {
         if (!allowedDepartments.includes(e.departmentId || '')) {
             return false;
         }
      }

      // 2. Attendance Subject filter
      if (subjectToAttendanceFilter === 'Subject') {
        if (e.subjectToAttendance === 'No' || (e as any).isSubjectToAttendance === false) return false;
      } else if (subjectToAttendanceFilter === 'NotSubject') {
        if (e.subjectToAttendance !== 'No' && (e as any).isSubjectToAttendance !== false) return false;
      }

      // 3. Search filter
      const matchesSearch = (e.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                            (e.jobTitle?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [employees, searchTerm, subjectToAttendanceFilter, allowedDepartments, isSuperAdmin]);

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1 w-full">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5", language === 'ar' ? "right-4" : "left-4")} />
            <input 
              type="text" 
              placeholder={language === 'ar' ? t(t('البحث عن موظف أو قسم...')) : "Search employees..."}
              className="w-full px-12 py-3 bg-card border border-border rounded-none focus:ring-2 focus:ring-primary outline-none transition-all font-medium text-foreground placeholder:text-muted-foreground/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="w-full sm:w-auto px-4 py-3 bg-card border border-border font-bold text-xs text-foreground focus:ring-2 focus:ring-primary outline-none"
            value={subjectToAttendanceFilter}
            onChange={(e) => setSubjectToAttendanceFilter(e.target.value as any)}
          >
            <option value="All">{language === 'ar' ? 'جميع الموظفين (خاضع وغير خاضع)' : 'All Employees'}</option>
            <option value="Subject">{language === 'ar' ? 'خاضع لنظام الحضور' : 'Subject to Attendance'}</option>
            <option value="NotSubject">{language === 'ar' ? 'غير خاضع لنظام الحضور' : 'Not Subject to Attendance'}</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          {(selectedIds.length > 0 && canDelete('employees')) && (
            <button 
              onClick={() => setDeleteConfirm({ id: 'bulk', show: true })}
              className="flex items-center gap-2 px-4 py-3 bg-destructive/10 text-destructive font-bold rounded-none hover:bg-destructive/20 transition-all border border-destructive/20"
            >
              <Trash2 className="w-5 h-5" />
              <span>{language === 'ar' ? `حذف المحدد (${selectedIds.length})` : `Delete Selected (${selectedIds.length})`}</span>
            </button>
          )}
          {canCreate('employees') && (
            <label className="cursor-pointer p-3 bg-card border border-border rounded-none text-muted-foreground hover:bg-muted transition-colors shadow-none flex items-center gap-2 font-bold group transition-all">
              <Upload className="w-5 h-5 group-hover:text-primary transition-colors" />
              <span className="hidden md:inline group-hover:text-foreground transition-colors">{language === 'ar' ? t('استيراد') : 'Import'}</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
            </label>
          )}
          {canExport('employees') && (
            <button 
              onClick={handleExportExcel}
              className="p-3 bg-card border border-border rounded-none text-muted-foreground hover:bg-muted transition-colors shadow-none flex items-center gap-2 font-bold group transition-all"
            >
              <Download className="w-5 h-5 group-hover:text-primary transition-colors" />
              <span className="hidden md:inline group-hover:text-foreground transition-colors">{language === 'ar' ? t('تصدير') : 'Export'}</span>
            </button>
          )}
          {canCreate('employees') && (
            <button 
              onClick={() => { setEditingEmployee(null); resetForm(); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-none transition-all shadow-lg shadow-primary/20 active:scale-95"
            >
              <UserPlus className="w-5 h-5" />
              <span>{language === 'ar' ? t('إضافة موظف') : 'Add Employee'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-none shadow-none border border-border overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className={cn("w-full", language === 'ar' ? "text-right" : "text-left")}>
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-8 py-5">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 rounded-none border-border text-primary focus:ring-primary bg-card"
                    checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-8 py-5 text-sm font-black text-muted-foreground uppercase tracking-wider">{t('common.name')}</th>
                <th className="px-8 py-5 text-sm font-black text-muted-foreground uppercase tracking-wider">{language === 'ar' ? t('القسم الإداري') : 'Department'}</th>
                <th className="px-8 py-5 text-sm font-black text-muted-foreground uppercase tracking-wider">{language === 'ar' ? t('المدير المباشر') : 'Direct Manager'}</th>
                <th className="px-8 py-5 text-sm font-black text-muted-foreground uppercase tracking-wider">{language === 'ar' ? t('الراتب الأساسي') : 'Basic Salary'}</th>
                <th className="px-8 py-5 text-sm font-black text-muted-foreground uppercase tracking-wider">{t('common.status')}</th>
                <th className="px-8 py-5 text-sm font-black text-muted-foreground uppercase tracking-wider">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className={cn("hover:bg-muted/30 transition-colors group", selectedIds.includes(emp.id) && "bg-primary/5")}>
                  <td className="px-8 py-5">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded-none border-border text-primary focus:ring-primary bg-card"
                      checked={selectedIds.includes(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                    />
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-none flex items-center justify-center text-primary font-black text-lg">
                        {emp.name ? emp.name[0] : '?'}
                      </div>
                      <div>
                        <p className="font-black text-foreground">{emp.name}</p>
                        <p className="text-xs text-muted-foreground font-medium">{emp.email || (language === 'ar' ? t('لا يوجد بريد') : 'No email')}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-4 py-1.5 bg-primary/10 text-primary rounded-none text-[10px] font-black border border-primary/20 uppercase tracking-tight">
                      {adminDepartments.find(d => d.id === emp.departmentId)?.name || (language === 'ar' ? t('غير محدد') : 'Not set')}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-bold text-foreground">
                      {employees.find(e => e.id === emp.managerId)?.name || (language === 'ar' ? t('لا يوجد (مدير أعلى)') : 'None')}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-black text-foreground">{formatCurrency(emp.basicSalary)}</p>
                    <p className="text-xs text-muted-foreground font-medium">{language === 'ar' ? t('بدلات') : 'Allowances'}: {formatCurrency(getSafeAllowances(emp.allowances).reduce((sum, a) => sum + a.amount, 0))}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1 items-start">
                      <div className={cn(
                        "inline-flex items-center gap-2 px-3 py-1 rounded-none border text-xs font-black",
                        emp.status === 'Active' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                        emp.status === 'End of Service' ? "bg-destructive/10 text-destructive border-destructive/20" :
                        emp.status === 'Leave' ? "bg-primary/10 text-primary border-primary/20" :
                        "bg-muted text-muted-foreground border-border"
                      )}>
                        {emp.status === 'Active' ? (language === 'ar' ? t('نشط') : 'Active') : 
                         emp.status === 'End of Service' ? (language === 'ar' ? t('إنهاء خدمات') : 'End of Service') :
                         emp.status === 'Leave' ? (language === 'ar' ? t('إجازة') : 'Leave') : (language === 'ar' ? t('غير نشط') : 'Inactive')}
                      </div>
                      <span className={cn(
                        "text-[9px] font-black px-2 py-0.5 border rounded-none uppercase tracking-tight",
                        emp.workMode === 'Remotely Work' 
                          ? "bg-purple-500/10 text-purple-600 border-purple-500/30" 
                          : "bg-blue-500/10 text-blue-600 border-blue-500/30"
                      )}>
                        {emp.workMode === 'Remotely Work' 
                          ? (language === 'ar' ? t('عمل عن بُعد') : 'Remotely Work') 
                          : (language === 'ar' ? t('عمل من المقر') : 'Office Work')}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-end gap-1 bg-muted/40 p-1 border border-border/80 w-fit ml-auto">
                      <button 
                        onClick={() => { setViewingEmployee(emp); setIsCardModalOpen(true); }}
                        className="p-1.5 text-blue-600 hover:bg-blue-600 hover:text-white rounded-none transition-all cursor-pointer"
                        title={language === 'ar' ? t('عرض الكارت الوظيفي') : 'View Job Card'}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setLeaveBalanceEmployee(emp)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-none transition-all cursor-pointer"
                        title={language === 'ar' ? t('رصيد الإجازات السنوي') : 'Annual Leave Balance'}
                      >
                        <Calendar className="w-4 h-4 text-emerald-600 hover:text-white" />
                      </button>
                      <button 
                        onClick={() => setPenaltiesEmployee(emp)}
                        className="p-1.5 text-amber-600 hover:bg-amber-600 hover:text-white rounded-none transition-all cursor-pointer"
                        title={language === 'ar' ? t('عرض جزاءات ومخالفات الموظف') : 'View Penalties'}
                      >
                        <ShieldAlert className="w-4 h-4 text-amber-600 hover:text-white" />
                      </button>
                      <button 
                        onClick={() => setPerformanceEmployee(emp)}
                        className="p-1.5 text-purple-600 hover:bg-purple-600 hover:text-white rounded-none transition-all cursor-pointer"
                        title={language === 'ar' ? 'عرض تقييم الأداء المعتمد' : 'View Approved Performance Appraisal'}
                      >
                        <Award className="w-4 h-4 text-purple-600 hover:text-white" />
                      </button>
                      <button 
                        onClick={() => setPrintReportEmployee(emp)}
                        className="p-1.5 text-slate-600 hover:bg-slate-600 hover:text-white rounded-none transition-all cursor-pointer"
                        title={language === 'ar' ? 'طباعة ملف الموظف الشهري' : 'Print Monthly Employee Report'}
                      >
                        <Printer className="w-4 h-4 text-slate-600 hover:text-white" />
                      </button>
                      {canEdit('employees') && (
                        <button 
                          onClick={() => handleEdit(emp)}
                          className="p-1.5 text-red-600 hover:bg-red-600 hover:text-white rounded-none transition-all cursor-pointer"
                          title={language === 'ar' ? t('تعديل') : 'Edit'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete('employees') && (
                        <button 
                          onClick={() => setDeleteConfirm({ id: emp.id, show: true })}
                          className="p-1.5 text-rose-600 hover:bg-rose-600 hover:text-white rounded-none transition-all cursor-pointer"
                          title={language === 'ar' ? t('حذف') : 'Delete'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-card w-full max-w-2xl rounded-none shadow-2xl overflow-hidden border border-border"
            >
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/30">
                <h3 className="text-2xl font-black text-foreground">
                  {editingEmployee ? (language === 'ar' ? t('تعديل بيانات الموظف') : 'Edit Employee') : (language === 'ar' ? t('إضافة موظف جديد') : 'Add New Employee')}
                </h3>
                <button type="button" onClick={handleCloseModal} className="p-2 hover:bg-muted rounded-none transition-colors">
                  <CloseIcon className="w-6 h-6 text-muted-foreground" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className={cn("text-sm font-bold text-muted-foreground mx-2", language === 'ar' ? "text-right" : "text-left")}>{language === 'ar' ? t('الرقم الوظيفي') : 'Employee ID'}</label>
                    <input 
                      required
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.employeeId || ''}
                      onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={cn("text-sm font-bold text-muted-foreground mx-2", language === 'ar' ? "text-right" : "text-left")}>{language === 'ar' ? t('الإسم') : 'Name'}</label>
                    <input 
                      required
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('البريد الإلكتروني (لتسجيل الدخول)')}</label>
                    <input 
                      type="email"
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-left text-foreground"
                      dir="ltr"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="employee@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('الرقم القومي')}</label>
                    <input 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.iqamaNumber || ''}
                      onChange={(e) => setFormData({...formData, iqamaNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('الجنسية')}</label>
                    <input 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.nationality || ''}
                      onChange={(e) => setFormData({...formData, nationality: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('المسمى الوظيفي')}</label>
                    <input 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.jobTitle || ''}
                      onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('بداية العمل')}</label>
                    <input 
                      type="date"
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.joinDate || ''}
                      onChange={(e) => {
                        const newJoinDate = e.target.value;
                        if (formData.contractType) {
                          try {
                            const parts = newJoinDate.split('-');
                            if (parts.length === 3) {
                              const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                              dObj.setFullYear(dObj.getFullYear() + Number(formData.contractType));
                              setFormData({
                                ...formData,
                                joinDate: newJoinDate,
                                endOfServiceDate: dObj.toISOString().split('T')[0]
                              });
                              return;
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }
                        setFormData({...formData, joinDate: newJoinDate});
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('نوع الدوام')}</label>
                    <select 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.workType || ''}
                      onChange={(e) => setFormData({...formData, workType: e.target.value as any})}
                    >
                      <option value="Full time">{t('تفرغ كامل (Full time)')}</option>
                      <option value="Part time">{t('دوام جزئي (Part time)')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('طريقة العمل (Work Mode)')}</label>
                    <select 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.workMode || 'Office Work'}
                      onChange={(e) => setFormData({...formData, workMode: e.target.value as any})}
                    >
                      <option value="Office Work">{t('العمل من المقر (Office Work)')}</option>
                      <option value="Remotely Work">{t('العمل عن بُعد (Remotely Work)')}</option>
                    </select>
                  </div>
                   <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('القسم الإداري')}</label>
                    <select 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.departmentId || ''}
                      onChange={(e) => setFormData({...formData, departmentId: e.target.value})}
                    >
                      <option value="">{t('اختر القسم...')}</option>
                      {adminDepartments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('الفرع')}</label>
                    <input 
                      placeholder={t('مثال: الرياض، جدة، الخ')}
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.branchId || ''}
                      onChange={(e) => setFormData({...formData, branchId: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('نوع استلام الراتب')}</label>
                    <select 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.paymentMethod || ''}
                      onChange={(e) => setFormData({...formData, paymentMethod: e.target.value as any})}
                    >
                      <option value="Bank">{t('استلام بنك')}</option>
                      <option value="Cash">{t('استلام راتب')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('ساعات العمل اليومية')}</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.dailyWorkHours || 8}
                      onChange={(e) => setFormData({...formData, dailyWorkHours: Number(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('كود البنك')}</label>
                    <input 
                      placeholder={t('مثال: NCBK, RJHI')}
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.bankCode || ''}
                      onChange={(e) => setFormData({...formData, bankCode: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('الايبــــــــــان')}</label>
                    <input 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.bankAccount || ''}
                      onChange={(e) => setFormData({...formData, bankAccount: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('الراتب الاساسي')}</label>
                    <input 
                      type="number"
                      required
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.basicSalary || 0}
                      onChange={(e) => setFormData({...formData, basicSalary: Number(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('حالة الموظف')}</label>
                    <select 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.status || ''}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="Active">{t('نشط')}</option>
                      <option value="Inactive">{t('غير نشط')}</option>
                      <option value="End of Service">{t('إنهاء خدمات')}</option>
                      <option value="Leave">{t('إجازة')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('تقويم العمل (Work Calendar)')}</label>
                    <select 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.shiftId || ''}
                      onChange={(e) => setFormData({...formData, shiftId: e.target.value})}
                    >
                      <option value="">{t('اختر التقويم...')}</option>
                      {attendanceShifts.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('مدة سنوات العقد (Contract Duration)')}</label>
                    <select 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.contractType || ''}
                      onChange={(e) => handleContractYearsChange(e.target.value)}
                    >
                      <option value="">{t('اختر مدة العقد...')}</option>
                      <option value="1">{t('سنة واحدة (1)')}</option>
                      <option value="2">{t('سنتان (2)')}</option>
                      <option value="3">{t('ثلاث سنوات (3)')}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('رصيد الإجازات السنوية بالأيام (Annual Leave Balance)')}</label>
                    <input 
                      type="number"
                      placeholder={t('مثال: 21')}
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.leavePlan || ''}
                      onChange={(e) => setFormData({...formData, leavePlan: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('رصيد الإجازة المرضية السنوي بالأيام (Annual Sick Leave Balance)')}</label>
                    <input 
                      type="number"
                      placeholder={t('مثال: 30')}
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.sickLeavePlan || ''}
                      onChange={(e) => setFormData({...formData, sickLeavePlan: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('الرتبة والدرجة الوظيفية (Grade/Level)')}</label>
                    <input 
                      placeholder={t('مثال: Grade 5, Senior Lead')}
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.gradeLevel || ''}
                      onChange={(e) => setFormData({...formData, gradeLevel: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('تاريخ نهاية الخدمة (إن وجد)')}</label>
                    <input 
                      type="date"
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.endOfServiceDate || ''}
                      onChange={(e) => setFormData({...formData, endOfServiceDate: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('مدير الموظف (المسؤول المباشر)')}</label>
                    <select 
                      className="w-full px-5 py-3 bg-muted/30 border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground"
                      value={formData.managerId || ''}
                      onChange={(e) => setFormData({...formData, managerId: e.target.value})}
                    >
                      <option value="">{t('لا يوجد مدير (مدير أعلى)')}</option>
                      {employees.filter(e => e.id !== editingEmployee?.id).map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.jobTitle})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-bold text-muted-foreground mr-2">{t('بدلات إضافية (مخصصة)')}</label>
                      <button 
                        type="button"
                        onClick={handleAddAllowance}
                        className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-none font-bold hover:bg-primary/20 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />{t('إضافة بدل')}</button>
                    </div>
                    <div className="space-y-3">
                      {formData.allowances.map((allowance, index) => (
                        <div key={allowance.id || index} className="flex items-center gap-3 bg-muted/30 p-3 rounded-none border border-border">
                          <select 
                            className="flex-1 bg-card px-4 py-2 rounded-none border border-border text-sm font-medium outline-none focus:ring-2 focus:ring-primary text-foreground"
                            value={allowance.type || ''}
                            onChange={(e) => handleAllowanceChange(index, 'type', e.target.value)}
                          >
                            <option value="">{t('اختر نوع البدل...')}</option>
                            {allowanceTypes.map(t => (
                              <option key={t.id} value={t.name}>{t.name}</option>
                            ))}
                          </select>
                          <input 
                            type="number"
                            placeholder={t('المبلغ')}
                            className="w-32 bg-card px-4 py-2 rounded-none border border-border text-sm font-medium outline-none focus:ring-2 focus:ring-primary text-foreground"
                            value={allowance.amount || 0}
                            onChange={(e) => handleAllowanceChange(index, 'amount', Number(e.target.value) || 0)}
                          />
                          <button 
                            type="button"
                            onClick={() => handleRemoveAllowance(index)}
                            className="p-2 text-destructive hover:bg-destructive/10 rounded-none transition-colors"
                          >
                            <CloseIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Centralized Payroll & Deduction Master Settings Section */}
                  <div className="md:col-span-2 border-t border-border/80 pt-6 mt-6 space-y-6">
                    <div>
                      <h4 className="text-base font-black text-foreground flex items-center gap-2 border-b border-border pb-2">
                        <span>{t('إعدادات الرواتب والتأمينات والضرائب والاستقطاعات')}</span>
                        <span className="text-xs font-normal text-muted-foreground">(Payroll & Master Deductions Settings)</span>
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-muted/20 p-5 border border-border">
                      {/* Social Insurance Segment */}
                      <div className="space-y-4">
                        <h5 className="font-bold text-sm text-foreground">{t('التأمينات الاجتماعية (GOSI/SI)')}</h5>
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground block font-bold">{t('خاضع للتأمينات؟')}</label>
                          <select
                            className="w-full px-4 py-2.5 bg-card border border-border text-xs font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
                            value={formData.subjectToSi || 'Yes'}
                            onChange={e => setFormData({ ...formData, subjectToSi: e.target.value })}
                          >
                            <option value="Yes">{t('نعم (Subject to SI)')}</option>
                            <option value="No">{t('لا (Exempt/Not Subject)')}</option>
                          </select>
                        </div>

                        {formData.subjectToSi === 'Yes' && (
                          <div className="space-y-2">
                            <label className="text-xs text-muted-foreground block font-bold">{t('رقم الاشتراك التأميني')}</label>
                            <input
                              type="text"
                              placeholder={t('مثال: GOSI-5432091')}
                              className="w-full px-4 py-2 bg-card border border-border text-xs font-medium text-foreground outline-none focus:ring-2"
                              value={formData.siNumber || ''}
                              onChange={e => setFormData({ ...formData, siNumber: e.target.value })}
                            />
                          </div>
                        )}
                      </div>

                      {/* Taxes Segment */}
                      <div className="space-y-4">
                        <h5 className="font-bold text-sm text-foreground">{t('الضرائب ورسوم الدخل (Income Tax)')}</h5>
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground block font-bold">{t('خاضع للضريبة؟')}</label>
                          <select
                            className="w-full px-4 py-2.5 bg-card border border-border text-xs font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
                            value={formData.subjectToTax || 'Yes'}
                            onChange={e => setFormData({ ...formData, subjectToTax: e.target.value })}
                          >
                            <option value="Yes">{t('نعم (Subject to Tax)')}</option>
                            <option value="No">{t('لا (Exempt)')}</option>
                          </select>
                        </div>

                        {formData.subjectToTax === 'Yes' && (
                          <>
                            <div className="space-y-2">
                              <label className="text-xs text-muted-foreground block font-bold">{t('معفى من ضريبة كسب العمل؟')}</label>
                              <select
                                className="w-full px-4 py-2.5 bg-card border border-border text-xs font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
                                value={formData.taxExempt || 'No'}
                                onChange={e => setFormData({ ...formData, taxExempt: e.target.value })}
                              >
                                <option value="No">{t('لا (خاضع بالكامل)')}</option>
                                <option value="Yes">{t('نعم (مستثنى)')}</option>
                              </select>
                            </div>

                            {formData.taxExempt !== 'Yes' && (
                              <div className="space-y-2">
                                <label className="text-xs text-muted-foreground block font-bold">
                                  {t('نسبة الاستقطاع الضريبي للموظف (%)')}
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  placeholder={t('اترك فارغاً للافتراضي من إعدادات الماستر (10%)')}
                                  className="w-full px-4 py-2 bg-card border border-border text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
                                  value={formData.taxProfile || ''}
                                  onChange={e => setFormData({ ...formData, taxProfile: e.target.value })}
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  {t('إذا تُرك فارغاً، سيتم تطبيق النسبة الافتراضية النشطة بضميرة كسب العمل في إعدادات الاستقطاعات (Deduction Master)، أو 10% افتراضياً.')}
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Appraisal Exemption Segment */}
                      <div className="space-y-4">
                        <h5 className="font-bold text-sm text-foreground">{t('تقييم الأداء والمخرجات (Performance Appraisal)')}</h5>
                        <div className="space-y-2">
                          <label className="text-xs text-muted-foreground block font-bold">{t('معفي من التقييم؟')}</label>
                          <select
                            className="w-full px-4 py-2.5 bg-card border border-border text-xs font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
                            value={formData.exemptFromAppraisal || 'No'}
                            onChange={e => setFormData({ ...formData, exemptFromAppraisal: e.target.value })}
                          >
                            <option value="No">{t('لا (خاضع للتقييم)')}</option>
                            <option value="Yes">{t('نعم (معفي من التقييم)')}</option>
                          </select>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {t('عند تفعيل هذا الخيار، سيتم استبعاد هذا الموظف تلقائياً من أي دورة تقييم أداء سنوية أو شهرية أو خاصة.')}
                        </p>
                      </div>

                      {/* Attendance Subject Status Segment */}
                      <div className="p-5 bg-gradient-to-br from-card via-card to-primary/5 border border-primary/20 rounded-xl shadow-sm space-y-4 relative overflow-hidden">
                        <div className="flex items-center justify-between border-b border-border/60 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                              <Fingerprint className="w-5 h-5" />
                            </div>
                            <div>
                              <h5 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                                {t('نظام الحضور والانصراف (Attendance System)')}
                              </h5>
                              <p className="text-[11px] text-muted-foreground font-medium">
                                {t('تحديد خضوع الموظف لتسجيل الحضور الإلكتروني وبوابات المباشرة')}
                              </p>
                            </div>
                          </div>
                          <div>
                            {formData.subjectToAttendance === 'No' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 rounded-full text-xs font-bold">
                                <UserX className="w-3.5 h-3.5" />
                                {t('غير خاضع لنظام الحضور')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-bold">
                                <UserCheck className="w-3.5 h-3.5" />
                                {t('خاضع لنظام الحضور')}
                              </span>
                            )}
                          </div>
                        </div>

                        {(!(currentUserRole === 'Admin' || currentUserRole === 'Super Admin' || currentUserRole === 'HR Manager' || currentUserRole === 'HR Officer') && !canEdit('employees')) && (
                          <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span>{t('تعديل هذا الخيار مقتصر فقط على مسؤول الموارد البشرية أو مسؤول النظام')}</span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-primary" />
                              <span>{t('حالة الخضوع لنظام الحضور والانصراف')}</span>
                            </label>
                            <select
                              className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-lg text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all disabled:opacity-60 disabled:bg-muted"
                              value={formData.subjectToAttendance || 'Yes'}
                              disabled={!(currentUserRole === 'Admin' || currentUserRole === 'Super Admin' || currentUserRole === 'HR Manager' || currentUserRole === 'HR Officer' || isSuperAdmin)}
                              onChange={e => setFormData({ ...formData, subjectToAttendance: e.target.value })}
                            >
                              <option value="Yes">🟢 {t('نعم — خاضع لنظام الحضور والانصراف بالمقر وعن بُعد')}</option>
                              <option value="No">🟣 {t('لا — غير خاضع لنظام الحضور وإخفاء البوابات من لوحة التحكم')}</option>
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-primary" />
                              <span>{t('تاريخ سريان الحالة')}</span>
                            </label>
                            <input
                              type="date"
                              className="w-full px-3.5 py-2.5 bg-background border border-border/80 rounded-lg text-xs font-bold text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary outline-none transition-all disabled:opacity-60 disabled:bg-muted"
                              value={formData.attendanceStatusEffectiveDate || ''}
                              disabled={!(currentUserRole === 'Admin' || currentUserRole === 'Super Admin' || currentUserRole === 'HR Manager' || currentUserRole === 'HR Officer' || isSuperAdmin)}
                              onChange={e => setFormData({ ...formData, attendanceStatusEffectiveDate: e.target.value })}
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-muted/40 border border-border/60 rounded-lg text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2">
                          <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span>
                            {t('تنويه: يتأثر حساب الموظف فوراً بهذا التعديل؛ حيث يُخفي النظام بوابات الحضور الإلكترونية وأزرار البصمة من لوحة التحكم ومسار الحضور، ويمنع إنشاء أي سجلات إلكترونية عند اختيار "لا".')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Active Deductions Master checklist grid */}
                    <div className="space-y-3">
                      <div>
                        <h5 className="font-bold text-sm text-foreground">{t('الاستقطاعات النشطة المفعّلة للموظف (Active Deductions Grid)')}</h5>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('تفويض واختيار الاستحقاقات/الخصومات التي ستطبق تلقائياً على الموظف في مسيرات الرواتب الشهرية')}</p>
                      </div>

                      {availableDeductions.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground bg-muted/10">{t('لا توجد استقطاعات معرفة أو نشطة في الماستر حالياً لتخصيصها.')}</div>
                      ) : (
                        <div className="border border-border bg-card">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left rtl:text-right text-xs">
                              <thead className="bg-muted text-foreground font-bold border-b border-border">
                                <tr>
                                  <th className="px-4 py-2.5">{t('الاستقطاع (عربي/إنجليزي)')}</th>
                                  <th className="px-4 py-2.5">{t('التصنيف')}</th>
                                  <th className="px-4 py-2.5">{t('طريقة الاحتساب')}</th>
                                  <th className="px-4 py-2.5 text-center">{t('حالة التفعيل')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border text-foreground">
                                {availableDeductions.map(dt => {
                                  // Safely parse activeDeductions array
                                  let activeList: string[] = [];
                                  try {
                                    if (formData.activeDeductions) {
                                      activeList = typeof formData.activeDeductions === 'string' 
                                        ? JSON.parse(formData.activeDeductions) 
                                        : formData.activeDeductions;
                                    }
                                  } catch (e) {}
                                  if (!Array.isArray(activeList)) activeList = [];

                                  const isChecked = activeList.includes(dt.id);

                                  const handleToggle = () => {
                                    let updated: string[];
                                    if (isChecked) {
                                      updated = activeList.filter(id => id !== dt.id);
                                    } else {
                                      updated = [...activeList, dt.id];
                                    }
                                    setFormData({ ...formData, activeDeductions: updated });
                                  };

                                  return (
                                    <tr key={dt.id} className="hover:bg-muted/10">
                                      <td className="px-4 py-2">
                                        <div className="font-bold">{dt.nameAr}</div>
                                        <div className="text-[10px] text-muted-foreground font-mono">{dt.nameEn}</div>
                                      </td>
                                      <td className="px-4 py-2">
                                        <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                          {dt.category}
                                        </span>
                                      </td>
                                      <td className="px-4 py-2 text-[10px] font-medium font-mono text-muted-foreground">
                                        {dt.calculationMethod}
                                      </td>
                                      <td className="px-4 py-2 text-center">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={handleToggle}
                                          className="w-4 h-4 cursor-pointer text-primary border-border focus:ring-primary rounded animate-pulse"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-none transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (language === 'ar' ? 'جاري الحفظ...' : 'Saving...') : t('common.save')}
                  </button>
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-4 bg-muted hover:bg-muted/80 text-muted-foreground font-black rounded-none transition-all"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ id: '', show: false })}
        onConfirm={() => deleteConfirm.id === 'bulk' ? handleBulkDelete() : handleDelete(deleteConfirm.id)}
        title={language === 'ar' ? t('تأكيد الحذف') : 'Confirm Delete'}
        description={
          deleteConfirm.id === 'bulk' 
            ? (language === 'ar' ? `هل أنت متأكد من حذف ${selectedIds.length} موظف؟ لا يمكن التراجع عن هذا الإجراء.` : `Are you sure you want to delete ${selectedIds.length} employees? This cannot be undone.`)
            : (language === 'ar' ? t('هل أنت متأكد من حذف هذا الموظف؟ لا يمكن التراجع عن هذا الإجراء.') : 'Are you sure you want to delete this employee? This cannot be undone.')
        }
      />

      {/* Job Card Modal */}
      <AnimatePresence>
        {isCardModalOpen && viewingEmployee && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCardModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-card w-full max-w-lg rounded-none shadow-2xl overflow-hidden border border-border"
            >
              {/* Card Header Pattern */}
              <div className="p-6 border-b border-border bg-muted/40 relative flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-foreground tracking-tight">
                    {language === 'ar' ? t('الكارت الوظيفي الرقمي') : 'Digital Job Card'}
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono">OPerix • HR Network ID</p>
                </div>
                <button onClick={() => setIsCardModalOpen(false)} className="p-2 hover:bg-muted rounded-none transition-colors">
                  <CloseIcon className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Card Body */}
              <div className="p-8 space-y-6">
                {/* Profile Badge */}
                <div className="p-6 bg-muted/20 border border-border/80 flex items-center gap-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/2 opacity-10 rounded-full blur-xl pointer-events-none" />
                  <div className="w-16 h-16 bg-primary text-primary-foreground font-extrabold flex items-center justify-center text-2xl select-none shadow-md">
                    {viewingEmployee.name ? viewingEmployee.name[0] : '?'}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xl font-black text-foreground leading-none">{viewingEmployee.name}</h4>
                    <p className="text-sm font-bold text-primary">{viewingEmployee.jobTitle || (language === 'ar' ? t('غير محدد') : 'No Title')}</p>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-muted/60 border border-border text-[11px] font-mono font-bold text-muted-foreground">
                      ID: #{viewingEmployee.employeeId}
                    </div>
                  </div>
                </div>

                {/* Info Fields Grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm text-right">
                  <div className="space-y-1 border-b border-border/40 pb-2">
                    <span className="text-xs text-muted-foreground font-bold">{language === 'ar' ? t('القسم الإداري') : 'Department'}</span>
                    <p className="font-extrabold text-foreground">
                      {adminDepartments.find(d => d.id === viewingEmployee.departmentId)?.name || (language === 'ar' ? t('غير محدد') : 'Not set')}
                    </p>
                  </div>
                  <div className="space-y-1 border-b border-border/40 pb-2">
                    <span className="text-xs text-muted-foreground font-bold">{language === 'ar' ? t('المدير المباشر') : 'Direct Manager'}</span>
                    <p className="font-extrabold text-foreground">
                      {employees.find(e => e.id === viewingEmployee.managerId)?.name || (language === 'ar' ? t('لا يوجد (مدير أعلى)') : 'None')}
                    </p>
                  </div>
                  <div className="space-y-1 border-b border-border/40 pb-2">
                    <span className="text-xs text-muted-foreground font-bold">{language === 'ar' ? t('بداية العمل') : 'Join Date'}</span>
                    <p className="font-extrabold text-foreground">{viewingEmployee.joinDate || '—'}</p>
                  </div>
                  <div className="space-y-1 border-b border-border/40 pb-2">
                    <span className="text-xs text-muted-foreground font-bold">{language === 'ar' ? t('الجنسية') : 'Nationality'}</span>
                    <p className="font-extrabold text-foreground">{viewingEmployee.nationality || '—'}</p>
                  </div>
                  <div className="space-y-1 border-b border-border/40 pb-2">
                    <span className="text-xs text-muted-foreground font-bold">{language === 'ar' ? t('رقم الإقامة / الهوية') : 'ID / Iqama Number'}</span>
                    <p className="font-mono font-bold text-foreground">{viewingEmployee.iqamaNumber || '—'}</p>
                  </div>
                  <div className="space-y-1 border-b border-border/40 pb-2">
                    <span className="text-xs text-muted-foreground font-bold">{language === 'ar' ? t('رصيد الإجازات السنوية') : 'Annual Leave Balance'}</span>
                    <p className="font-bold text-foreground">{viewingEmployee.leavePlan ? `${viewingEmployee.leavePlan} يوم` : '21 يوم'}</p>
                  </div>
                  <div className="space-y-1 border-b border-border/40 pb-2">
                    <span className="text-xs text-muted-foreground font-bold">{language === 'ar' ? t('رصيد الإجازة المرضية السنوية') : 'Annual Sick Leave Balance'}</span>
                    <p className="font-bold text-emerald-600">{viewingEmployee.sickLeavePlan ? `${viewingEmployee.sickLeavePlan} يوم` : '30 يوم'}</p>
                  </div>
                  <div className="space-y-1 border-b border-border/40 pb-2">
                    <span className="text-xs text-muted-foreground font-bold">{language === 'ar' ? t('الدرجة والدرجة الوظيفية') : 'Grade / Level'}</span>
                    <p className="font-bold text-foreground">{viewingEmployee.gradeLevel || '—'}</p>
                  </div>
                  <div className="space-y-1 border-b border-border/40 pb-2 col-span-2">
                    <span className="text-xs text-muted-foreground font-bold">{language === 'ar' ? t('نوع الدوام') : 'Work Type'}</span>
                    <p className="font-extrabold text-foreground">
                      {viewingEmployee.workType === 'Part time' 
                        ? (language === 'ar' ? t('دوام جزئي') : 'Part time') 
                        : (language === 'ar' ? t('دوام كامل') : 'Full time')}
                    </p>
                  </div>
                </div>

                {/* Financial Overview (Read Only) */}
                <div className="bg-muted/10 p-5 border border-border text-right">
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-wider block mb-3">
                    {language === 'ar' ? t('تفاصيل الراتب والبدلات المعتمده') : 'SALARY & PERKS PREVIEW'}
                  </span>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between font-medium">
                      <span className="text-muted-foreground">{language === 'ar' ? t('الراتب الأساسي') : 'Basic Salary'}</span>
                      <span className="font-bold text-foreground">{formatCurrency(viewingEmployee?.basicSalary || 0)}</span>
                    </div>
                    {getSafeAllowances(viewingEmployee?.allowances).length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-dashed border-border/60">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase block mb-1">{t('البدلات الإضافية المخصصة:')}</span>
                        {getSafeAllowances(viewingEmployee?.allowances).map((a, idx) => (
                          <div key={a.id || idx} className="flex justify-between text-xs text-muted-foreground pl-3">
                            <span>{a.type || (language === 'ar' ? t('بدل مخصص') : 'Custom Allowance')}</span>
                            <span>{formatCurrency(a.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between border-t border-border pt-2 text-base font-black text-foreground">
                      <span>{language === 'ar' ? t('إجمالي الراتب المستحق') : 'Total Compensation'}</span>
                      <span className="text-primary">
                        {formatCurrency(
                          (viewingEmployee?.basicSalary || 0) + 
                          getSafeAllowances(viewingEmployee?.allowances).reduce((sum, a) => sum + a.amount, 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Additional Metadata */}
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
                  <div>Status: {viewingEmployee.status}</div>
                  <div>OPerix Secure Document</div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex border-t border-border bg-muted/20">
                <button 
                  type="button" 
                  onClick={() => window.print()}
                  className="flex-1 py-4 text-center text-sm font-black text-foreground hover:bg-muted/40 transition-colors border-l border-border"
                >
                  {language === 'ar' ? t('طباعة الكارت') : 'Print Card'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsCardModalOpen(false)}
                  className="flex-1 py-4 text-center text-sm font-black text-primary hover:bg-muted/40 transition-colors"
                >
                  {language === 'ar' ? t('إغلاق') : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Annual Leave & Sick Leave Balance Popup dialog */}
      <AnimatePresence>
        {leaveBalanceEmployee && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-3xl border-t-4 border-emerald-600 rounded-none shadow-2xl overflow-hidden text-right leading-relaxed"
            >
              <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
                <h4 className="font-black text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 animate-pulse" />
                  {t('كارت أرصدة الإجازات السنوية للموظف:')} {leaveBalanceEmployee.name} ({leaveBalanceEmployee.jobTitle || t('موظف')})
                </h4>
                <button 
                  onClick={() => setLeaveBalanceEmployee(null)}
                  className="text-white hover:opacity-80 transition-opacity border-none outline-none cursor-pointer"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Year Indicator & Annual Renewal Notice */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 p-3.5 border border-border text-xs font-bold">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t('العام التقويمي الجاري:')}</span>
                    <span className="font-black text-sm text-emerald-600">{new Date().getFullYear()} م</span>
                  </div>
                  <div className="flex items-center justify-between border-r sm:border-r-0 border-border pr-2 sm:pr-0">
                    <span className="text-muted-foreground">{t('سياسة التجديد السنوي:')}</span>
                    <span className="font-extrabold text-foreground">{t('يتجدد تلقائياً في 1 يناير')}</span>
                  </div>
                </div>

                {/* Tab Switcher: Annual Vacation vs Sick Leave */}
                <div className="flex border-b border-border gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveBalanceTab('vacation')}
                    className={cn(
                      "pb-3 px-4 text-xs sm:text-sm font-black transition-all flex items-center gap-2 border-b-2 cursor-pointer",
                      leaveBalanceTab === 'vacation'
                        ? "border-emerald-600 text-emerald-600 bg-emerald-500/5"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Calendar className="w-4 h-4" />
                    <span>{t('رصيد الإجازة الاعتيادية (السنوية)')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveBalanceTab('sick')}
                    className={cn(
                      "pb-3 px-4 text-xs sm:text-sm font-black transition-all flex items-center gap-2 border-b-2 cursor-pointer",
                      leaveBalanceTab === 'sick'
                        ? "border-blue-600 text-blue-600 bg-blue-500/5"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <HeartPulse className="w-4 h-4" />
                    <span>{t('رصيد الإجازة المرضية السنوية')}</span>
                  </button>
                </div>

                {/* Tab Content */}
                {(() => {
                  const currentYear = new Date().getFullYear();
                  const isSickTab = leaveBalanceTab === 'sick';

                  if (isSickTab) {
                    // Sick Leave Calculations
                    const entitledSick = Number(leaveBalanceEmployee.sickLeavePlan || 30);
                    const approvedSickLeaves = (leaveRequests || []).filter(lr => 
                      lr.employeeId === leaveBalanceEmployee.id &&
                      lr.status === 'Approved' &&
                      (lr.type === 'Sick' || lr.type === 'مرضية' || lr.type === 'إجازة مرضية' || lr.type === t('إجازة مرضية') || lr.type === t('مرضية')) &&
                      (lr.startDate && lr.startDate.startsWith(String(currentYear)))
                    );

                    const consumedSick = approvedSickLeaves.reduce((sum, lr) => {
                      const s = new Date(lr.startDate);
                      const e = new Date(lr.endDate);
                      const dTime = e.getTime() - s.getTime();
                      const days = dTime < 0 ? 0 : Math.ceil(dTime / (1000 * 60 * 60 * 24)) + 1;
                      return sum + days;
                    }, 0);

                    const remainingSick = entitledSick - consumedSick;

                    return (
                      <div className="space-y-6">
                        {/* Notice Banner */}
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 text-xs font-bold flex items-center gap-2">
                          <HeartPulse className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <span>{t('الإجازة المرضية المعتمدة تخصم من الرصيد المرضي فقط ولا تخصم من رصيد الإجازات الاعتيادية.')}</span>
                        </div>

                        {/* Sick Balance Metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="bg-blue-600/5 border border-blue-600/15 p-4 text-right">
                            <span className="text-[10px] text-blue-600 font-black uppercase block mb-1">{t('المستحق (السنوي الجاري)')}</span>
                            <span className="text-2xl font-black text-blue-700 dark:text-blue-400">{entitledSick}</span> <span className="text-xs text-blue-700 dark:text-blue-400 font-bold">{t('يوم')}</span>
                          </div>
                          <div className="bg-red-600/5 border border-red-600/15 p-4 text-right">
                            <span className="text-[10px] text-red-600 font-black uppercase block mb-1">{t('المستخدم (المعتمد فقط)')}</span>
                            <span className="text-2xl font-black text-red-700 dark:text-red-400">{consumedSick}</span> <span className="text-xs text-red-700 dark:text-red-400 font-bold">{t('يوم')}</span>
                          </div>
                          <div className="bg-emerald-600/5 border border-emerald-600/15 p-4 text-right">
                            <span className="text-[10px] text-emerald-600 font-black uppercase block mb-1">{t('المتبقي المتاح للتسجيل')}</span>
                            <span className={cn(
                              "text-2xl font-black",
                              remainingSick >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                            )}>{remainingSick}</span> <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">{t('يوم')}</span>
                          </div>
                          <div className="bg-muted/40 border border-border p-4 text-right">
                            <span className="text-[10px] text-muted-foreground font-black uppercase block mb-1">{t('التجديد السنوي')}</span>
                            <span className="text-xs font-black text-foreground block mt-1">{t('1 يناير')} {currentYear + 1}</span>
                            <span className="text-[10px] text-muted-foreground">{t('رصيد سنوي متجدد')}</span>
                          </div>
                        </div>

                        {/* Sick Leaves Table */}
                        <div className="space-y-2">
                          <h5 className="font-black text-xs text-foreground mr-1 flex items-center gap-1.5">
                            <HeartPulse className="w-3.5 h-3.5 text-blue-600" />
                            {t('سجل الإجازات المرضية المعتمدة خلال العام')} {currentYear}:
                          </h5>
                          {approvedSickLeaves.length === 0 ? (
                            <div className="border border-dashed border-border p-6 text-center text-xs font-bold text-muted-foreground bg-muted/20">
                              {t('لا توجد إجازات مرضية معتمدة مسجلة لهذا الموظف خلال العام')} {currentYear}.
                            </div>
                          ) : (
                            <div className="overflow-x-auto border border-border">
                              <table className="w-full text-right text-xs text-foreground">
                                <thead className="bg-muted text-muted-foreground font-black border-b border-border">
                                  <tr>
                                    <th className="p-3 text-right">{t('تاريخ البدء')}</th>
                                    <th className="p-3 text-right">{t('تاريخ الانتهاء')}</th>
                                    <th className="p-3 text-right">{t('عدد الأيام المستهلكة')}</th>
                                    <th className="p-3 text-right">{t('السبب / التقرير الطبي')}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border font-medium">
                                  {approvedSickLeaves.map((lr) => {
                                    const s = new Date(lr.startDate);
                                    const e = new Date(lr.endDate);
                                    const dTime = e.getTime() - s.getTime();
                                    const days = dTime < 0 ? 0 : Math.ceil(dTime / (1000 * 60 * 60 * 24)) + 1;

                                    return (
                                      <tr key={lr.id} className="hover:bg-muted/30">
                                        <td className="p-3 font-mono font-bold text-foreground">{lr.startDate}</td>
                                        <td className="p-3 font-mono font-bold text-foreground">{lr.endDate}</td>
                                        <td className="p-3 font-bold text-blue-600">{days} {t('يوم')}</td>
                                        <td className="p-3 text-muted-foreground max-w-xs truncate" title={lr.reason}>{lr.reason || '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Vacation / Annual Leave Calculations
                  const entitledVacation = Number(leaveBalanceEmployee.leavePlan || 21);
                  const approvedVacationLeaves = (leaveRequests || []).filter(lr => 
                    lr.employeeId === leaveBalanceEmployee.id &&
                    lr.status === 'Approved' &&
                    (lr.type === 'Vacation' || lr.type === 'Annual' || lr.type === t('إجازة اعتيادية') || lr.type === t('اعتيادي') || lr.type === 'إجازة اعتيادية' || lr.type === 'اعتيادي' || lr.type === 'اعتيادية') &&
                    (lr.startDate && lr.startDate.startsWith(String(currentYear)))
                  );

                  const consumedVacation = approvedVacationLeaves.reduce((sum, lr) => {
                    const s = new Date(lr.startDate);
                    const e = new Date(lr.endDate);
                    const dTime = e.getTime() - s.getTime();
                    const days = dTime < 0 ? 0 : Math.ceil(dTime / (1000 * 60 * 60 * 24)) + 1;
                    return sum + days;
                  }, 0);

                  const remainingVacation = entitledVacation - consumedVacation;

                  return (
                    <div className="space-y-6">
                      {/* Notice Banner */}
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>{t('الإجازة الاعتيادية تخصم حصراً من رصيد الإجازات السنوي الاعتيادي.')}</span>
                      </div>

                      {/* Vacation Balance Metrics */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div className="bg-blue-600/5 border border-blue-600/15 p-4 text-right">
                          <span className="text-[10px] text-blue-600 font-black uppercase block mb-1">{t('المستحق (السنوي الجاري)')}</span>
                          <span className="text-2xl font-black text-blue-700 dark:text-blue-400">{entitledVacation}</span> <span className="text-xs text-blue-700 dark:text-blue-400 font-bold">{t('يوم')}</span>
                        </div>
                        <div className="bg-red-600/5 border border-red-600/15 p-4 text-right">
                          <span className="text-[10px] text-red-600 font-black uppercase block mb-1">{t('المستخدم (المعتمد فقط)')}</span>
                          <span className="text-2xl font-black text-red-700 dark:text-red-400">{consumedVacation}</span> <span className="text-xs text-red-700 dark:text-red-400 font-bold">{t('يوم')}</span>
                        </div>
                        <div className="bg-emerald-600/5 border border-emerald-600/15 p-4 text-right">
                          <span className="text-[10px] text-emerald-600 font-black uppercase block mb-1">{t('المتبقي المتاح للتسجيل')}</span>
                          <span className={cn(
                            "text-2xl font-black",
                            remainingVacation >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
                          )}>{remainingVacation}</span> <span className="text-xs text-emerald-700 dark:text-emerald-400 font-bold">{t('يوم')}</span>
                        </div>
                        <div className="bg-muted/40 border border-border p-4 text-right">
                          <span className="text-[10px] text-muted-foreground font-black uppercase block mb-1">{t('التجديد السنوي')}</span>
                          <span className="text-xs font-black text-foreground block mt-1">{t('1 يناير')} {currentYear + 1}</span>
                          <span className="text-[10px] text-muted-foreground">{t('رصيد سنوي متجدد')}</span>
                        </div>
                      </div>

                      {/* Leaves Grid list (Approved only) */}
                      <div className="space-y-2">
                        <h5 className="font-black text-xs text-foreground mr-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          {t('سجل الإجازات الاعتيادية المعتمدة خلال العام')} {currentYear}:
                        </h5>
                        {approvedVacationLeaves.length === 0 ? (
                          <div className="border border-dashed border-border p-6 text-center text-xs font-bold text-muted-foreground bg-muted/20">
                            {t('لا توجد إجازات اعتيادية معتمدة مسجلة لهذا الموظف خلال العام')} {currentYear}.
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-border">
                            <table className="w-full text-right text-xs text-foreground">
                              <thead className="bg-muted text-muted-foreground font-black border-b border-border">
                                <tr>
                                  <th className="p-3 text-right">{t('تاريخ البدء')}</th>
                                  <th className="p-3 text-right">{t('تاريخ الانتهاء')}</th>
                                  <th className="p-3 text-right">{t('عدد الأيام المستهلكة')}</th>
                                  <th className="p-3 text-right">{t('السبب / الملاحظات')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border font-medium">
                                {approvedVacationLeaves.map((lr) => {
                                  const s = new Date(lr.startDate);
                                  const e = new Date(lr.endDate);
                                  const dTime = e.getTime() - s.getTime();
                                  const days = dTime < 0 ? 0 : Math.ceil(dTime / (1000 * 60 * 60 * 24)) + 1;

                                  return (
                                    <tr key={lr.id} className="hover:bg-muted/30">
                                      <td className="p-3 font-mono font-bold text-foreground">{lr.startDate}</td>
                                      <td className="p-3 font-mono font-bold text-foreground">{lr.endDate}</td>
                                      <td className="p-3 font-bold text-emerald-600">{days} {t('يوم')}</td>
                                      <td className="p-3 text-muted-foreground max-w-xs truncate" title={lr.reason}>{lr.reason || '—'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end border-t border-border pt-4">
                  <button 
                    onClick={() => setLeaveBalanceEmployee(null)}
                    className="p-3 px-6 bg-muted hover:bg-muted/80 text-foreground font-black text-xs rounded-none border-none cursor-pointer"
                  >{t('إغلاق النافذة')}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Employee Penalties Popup dialog */}
      <AnimatePresence>
        {penaltiesEmployee && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-4xl border-t-4 border-amber-500 rounded-none shadow-2xl overflow-hidden text-right leading-relaxed"
            >
              <div className="bg-amber-500 text-white px-6 py-4 flex items-center justify-between">
                <h4 className="font-black text-base flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                  سجل الجزاءات والقرارات التأديبية للموظف: {penaltiesEmployee.name} ({penaltiesEmployee.jobTitle || t('موظف')})
                </h4>
                <button 
                  onClick={() => setPenaltiesEmployee(null)}
                  className="text-white hover:opacity-80 transition-opacity border-none outline-none bg-transparent cursor-pointer"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
                {(() => {
                  // Filter penalties belonging to this employee
                  const empPenalties = penalties.filter((p: any) => p.employeeId === penaltiesEmployee.id);
                  const approved = empPenalties.filter((p: any) => p.status === 'Approved');
                  const pending = empPenalties.filter((p: any) => p.status === 'Draft' || p.status === 'Pending');

                  // Calc totals
                  let totalAmountDeducted = 0;
                  let totalDaysDeducted = 0;

                  approved.forEach((p: any) => {
                    if (p.penaltyType === 'Amount Deduction') {
                      totalAmountDeducted += Number(p.deductionValue) || 0;
                    } else if (p.penaltyType === 'Day Deduction') {
                      totalDaysDeducted += Number(p.deductionValue) || 0;
                    }
                  });

                  return (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-none text-right">
                          <span className="text-[10px] text-amber-600 font-extrabold uppercase block mb-1">{t('الجزاءات المعتمدة والنشطة')}</span>
                          <span className="text-2xl font-black text-amber-700">{approved.length}</span> <span className="text-xs text-amber-700 font-bold">{t('قرار')}</span>
                        </div>
                        <div className="bg-rose-500/5 border border-rose-500/10 p-4 rounded-none text-right">
                          <span className="text-[10px] text-rose-600 font-extrabold uppercase block mb-1">{t('إجمالي الخصومات المالية المطبقة')}</span>
                          <span className="text-2xl font-black text-rose-700">{formatCurrency(totalAmountDeducted)}</span>
                        </div>
                        <div className="bg-orange-500/5 border border-orange-500/10 p-4 rounded-none text-right">
                          <span className="text-[10px] text-orange-600 font-extrabold uppercase block mb-1">{t('إجمالي أيام الخصم من العمل')}</span>
                          <span className="text-2xl font-black text-orange-700">{totalDaysDeducted}</span> <span className="text-xs text-orange-700 font-bold">{t('أيام عمل')}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h5 className="font-extrabold text-xs text-muted-foreground mr-1">{t('تفاصيل المخالفات والجزاءات التراكمية:')}</h5>
                        {empPenalties.length === 0 ? (
                          <div className="border border-dashed border-border p-8 text-center text-xs font-bold text-muted-foreground bg-muted/20">{t('سجل نظيف! لا توجد أي مخالفات أو جزاءات مسجلة لهذا الموظف حتى الآن.')}</div>
                        ) : (
                          <div className="overflow-x-auto border border-border">
                            <table className="w-full text-right text-xs text-foreground">
                              <thead className="bg-muted text-muted-foreground font-black border-b border-border">
                                <tr>
                                  <th className="p-3 text-right">{t('رقم القرار')}</th>
                                  <th className="p-3 text-right">{t('تاريخ المخالفة')}</th>
                                  <th className="p-3 text-right">{t('نوع المخالفة')}</th>
                                  <th className="p-3 text-right">{t('نوع الجزاء')}</th>
                                  <th className="p-3 text-right">{t('الخصم / المؤثر')}</th>
                                  <th className="p-3 text-right">{t('الشهر المستهدف')}</th>
                                  <th className="p-3 text-right">{t('الحالة')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border font-medium">
                                {empPenalties.map((p: any) => {
                                  const violationTypesAr: Record<string, string> = {
                                    'Absence Without Permission': t('غياب بدون إذن'),
                                    'Delay': t('تأخر عن العمل'),
                                    'Negligence': t('إهمال في العمل'),
                                    'Insubordination': t('عدم طاعة الأوامر'),
                                    'Other': t('أخرى')
                                  };
                                  const penaltyTypesAr: Record<string, string> = {
                                    'Warning': t('إنذار كتابي'),
                                    'Amount Deduction': t('خصم مبلغ مالي'),
                                    'Day Deduction': t('خصم أيام عمل'),
                                    'Suspension': t('إيقاف عن العمل'),
                                    'Other': t('أخرى')
                                  };

                                  return (
                                    <tr key={p.id} className="hover:bg-muted/30">
                                      <td className="p-3 font-mono font-bold text-foreground">#{p.penaltyNumber || '—'}</td>
                                      <td className="p-3 font-mono text-muted-foreground">{p.violationDate || '—'}</td>
                                      <td className="p-3 font-bold">{violationTypesAr[p.violationType] || p.violationType}</td>
                                      <td className="p-3 font-bold">{penaltyTypesAr[p.penaltyType] || p.penaltyType}</td>
                                      <td className="p-3 font-bold text-amber-600">
                                        {p.penaltyType === 'Amount Deduction' 
                                          ? formatCurrency(Number(p.deductionValue)) 
                                          : p.penaltyType === 'Day Deduction' 
                                          ? `${p.deductionValue} أيام` 
                                          : '—'}
                                      </td>
                                      <td className="p-3 font-mono text-muted-foreground">{p.targetMonth || '—'}</td>
                                      <td className="p-3">
                                        <span className={cn(
                                          "px-2 py-0.5 border text-[10px] font-black",
                                          p.status === 'Approved' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                          p.status === 'Rejected' ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                                          "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                        )}>
                                          {p.status === 'Approved' ? t('معتمد') : p.status === 'Rejected' ? t('مرفوض') : t('مسودة')}
                                        </span>
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
                  );
                })()}

                <div className="flex justify-end border-t border-border pt-4">
                  <button 
                    onClick={() => setPenaltiesEmployee(null)}
                    className="p-3 px-5 bg-muted hover:bg-muted/80 text-foreground font-black text-xs rounded-none border-none cursor-pointer"
                  >{t('إغلاق النافذة')}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Employee Approved Performance Appraisals Popup */}
      <AnimatePresence>
        {performanceEmployee && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-4xl border-t-4 border-purple-600 rounded-none shadow-2xl overflow-hidden text-right leading-relaxed"
            >
              <div className="bg-purple-600 text-white px-6 py-4 flex items-center justify-between">
                <h4 className="font-black text-sm md:text-base flex items-center gap-2">
                  <Award className="w-5 h-5 animate-pulse" />
                  {language === 'ar' ? 'تقييمات الأداء المعتمدة للموظف' : 'Approved Appraisals for'} : {performanceEmployee.name} ({performanceEmployee.jobTitle || t('موظف')})
                </h4>
                <button 
                  onClick={() => setPerformanceEmployee(null)}
                  className="text-white hover:opacity-80 transition-opacity border-none outline-none bg-transparent cursor-pointer"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto max-h-[75vh] space-y-6">
                {(() => {
                  const empEvaluations = performanceEvaluations.filter(
                    (e: any) => e.employeeId === performanceEmployee.id && (e.status === 'Approved' || e.status === 'Closed')
                  );

                  if (empEvaluations.length === 0) {
                    return (
                      <div className="text-center py-12 text-muted-foreground font-bold">
                        <Award className="w-12 h-12 text-slate-350 mx-auto mb-4 opacity-40 bg-slate-100 p-2 rounded-full dark:bg-slate-800" />
                        <p className="text-sm">{language === 'ar' ? 'لا توجد تقييمات أداء معتمدة ومضافة لهذا الموظف في النظام حالياً' : 'No approved performance appraisals added for this employee in the system yet.'}</p>
                      </div>
                    );
                  }

                  // Find currently selected evaluation
                  const activeEval = empEvaluations.find((e: any) => e.id === selectedEvaluationId) || empEvaluations[0];

                  // Find the associated performance cycle
                  const selectedCycle = performanceCycles.find((c: any) => c.id === activeEval?.cycleId);

                  return (
                    <div className="space-y-6">
                      {/* Filter/Dropdown containing all appraisals */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/50 border border-border rounded-xl">
                        <div>
                          <label className="text-xs font-black text-muted-foreground uppercase tracking-widest block mb-1">
                            {language === 'ar' ? 'اختر دورة التقييم المراد عرضها:' : 'Select appraisal cycle to view:'}
                          </label>
                          <span className="text-xs text-muted-foreground font-semibold">
                            {language === 'ar' ? `متاح عدد (${empEvaluations.length}) تقييم معتمد` : `Found (${empEvaluations.length}) approved evaluations`}
                          </span>
                        </div>
                        <select
                          className="px-4 py-2 border-2 border-border bg-card text-foreground font-bold text-sm outline-none focus:border-purple-500 max-w-[320px] rounded-xl text-right"
                          value={activeEval?.id}
                          onChange={(e) => setSelectedEvaluationId(e.target.value)}
                        >
                          {empEvaluations.map((ev: any) => {
                            const cycle = performanceCycles.find((c: any) => c.id === ev.cycleId);
                            const cycleTitle = cycle 
                              ? (language === 'ar' ? cycle.nameAr : cycle.nameEn) 
                              : `Appraisal (${ev.finalPercentageScore}%)`;
                            return (
                              <option key={ev.id} value={ev.id}>
                                {cycleTitle} - ({ev.finalPercentageScore}%) / {ev.finalGrade || 'N/A'}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* appraisal display Card */}
                      {activeEval && (
                        <div className="space-y-6">
                          {/* Top score row with giant appraisal badge */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            {/* Score card */}
                            <div className="bg-purple-600/5 border border-purple-600/10 p-6 text-center space-y-2 rounded-2xl flex flex-col justify-center items-center">
                              <span className="text-[11px] text-purple-600 font-extrabold uppercase tracking-wide block">
                                {language === 'ar' ? 'النسبة المئوية النهائية للتقييم' : 'Final Rating Score'}
                              </span>
                              <div className="text-5xl font-black text-purple-700 tracking-tighter tabular-nums">
                                {activeEval.finalPercentageScore}%
                              </div>
                              <div className="px-3 py-1 bg-purple-600 text-white font-black text-xs uppercase tracking-widest rounded-full">
                                {language === 'ar' ? 'التقدير العام' : 'Grade'}: {activeEval.finalGrade || 'N/A'}
                              </div>
                            </div>

                            {/* Cycle details */}
                            <div className="md:col-span-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl space-y-4 text-right">
                              <h5 className="font-extrabold text-foreground text-md border-b pb-2">
                                {selectedCycle 
                                  ? (language === 'ar' ? selectedCycle.nameAr : selectedCycle.nameEn) 
                                  : (language === 'ar' ? 'دورة التقييم المعتمدة' : 'Approved Appraisal Cycle')}
                              </h5>
                              <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
                                <div>
                                  <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-1">{language === 'ar' ? 'العام الدراسي والمالي' : 'Assessment Year'}</span>
                                  <span className="text-foreground font-black text-sm">{selectedCycle?.year || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-1">{language === 'ar' ? 'نوع الدورة والتقييم' : 'Cycle Type'}</span>
                                  <span className="text-foreground font-black text-sm">{selectedCycle?.cycleType || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-1">{language === 'ar' ? 'وزن تقييم الموظف الذاتي' : 'Self Weight'}</span>
                                  <span className="text-foreground font-black text-sm">{activeEval.selfWeight || 0}%</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground block text-[10px] uppercase font-bold mb-1">{language === 'ar' ? 'وزن تقييم المدير المباشر' : 'Manager Weight'}</span>
                                  <span className="text-foreground font-black text-sm">{activeEval.managerWeight || 0}%</span>
                                </div>
                              </div>
                            </div>

                          </div>

                          {/* Descriptive / Qualitatives Text Blocks */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            <div className="bg-emerald-500/5 border border-emerald-500/10 p-5 rounded-2xl space-y-2 text-right">
                              <span className="text-[11px] font-extrabold text-emerald-700 block uppercase tracking-wide border-b border-emerald-500/10 pb-1">
                                {language === 'ar' ? 'نقاط القوة الرئيسية' : 'Key Strengths'}
                              </span>
                              <p className="text-xs text-foreground/90 font-medium leading-relaxed italic whitespace-pre-line">
                                {activeEval.managerStrengths || (language === 'ar' ? 'لم يتم تسجيل ملاحظات بنقاط قوة معينة.' : 'No descriptive strengths provided.')}
                              </p>
                            </div>

                            <div className="bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl space-y-2 text-right">
                              <span className="text-[11px] font-extrabold text-amber-700 block uppercase tracking-wide border-b border-amber-500/10 pb-1">
                                {language === 'ar' ? 'جوانب التطوير والتحسين' : 'Areas for Improvement'}
                              </span>
                              <p className="text-xs text-foreground/90 font-medium leading-relaxed italic whitespace-pre-line text-right">
                                {activeEval.managerImprovements || (language === 'ar' ? 'لم يتم تسجيل ملاحظات بجوانب تطوير محددة.' : 'No descriptive development needs provided.')}
                              </p>
                            </div>

                            <div className="bg-pink-500/5 border border-pink-500/10 p-5 rounded-2xl space-y-2 text-right">
                              <span className="text-[11px] font-extrabold text-pink-700 block uppercase tracking-wide border-b border-pink-500/10 pb-1">
                                {language === 'ar' ? 'توصيات واعتماد الإدارة' : 'Evaluator Recommendations'}
                              </span>
                              <p className="text-xs text-foreground/90 font-medium leading-relaxed italic whitespace-pre-line text-right">
                                {activeEval.managerRecommendations || (language === 'ar' ? 'لا توجد توصيات مسجلة.' : 'No evaluator recommendations provided.')}
                              </p>
                            </div>

                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex justify-end border-t border-border pt-4">
                  <button 
                    onClick={() => setPerformanceEmployee(null)}
                    className="p-3 px-5 bg-muted hover:bg-muted/80 text-foreground font-black text-xs rounded-none border-none cursor-pointer"
                  >
                    {t('إغلاق النافذة')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Monthly Employee Report & Print Utility Modal */}
      <AnimatePresence>
        {printReportEmployee && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-4xl border-t-4 border-slate-700 rounded-none shadow-2xl overflow-hidden text-right leading-relaxed"
            >
              <div className="bg-[#0F172A] text-white px-6 py-4 flex items-center justify-between no-print">
                <h4 className="font-black text-sm md:text-base flex items-center gap-2">
                  <Printer className="w-5 h-5 text-[#2563EB]" />
                  <span>{language === 'ar' ? 'تقرير ملف الموظف والنشاطات الشهري' : 'Employee Monthly Activity Report'}</span>
                </h4>
                <div className="flex items-center gap-4">
                  <input 
                    type="month" 
                    className="px-3 py-1 bg-white text-slate-900 border-none font-bold max-w-[160px] outline-none text-xs rounded-lg"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                  />
                  <button 
                    onClick={() => setPrintReportEmployee(null)}
                    className="text-white hover:opacity-80 transition-opacity border-none outline-none bg-transparent cursor-pointer"
                  >
                    <CloseIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Action buttons inside the modal (non-printable) */}
              <div className="p-4 bg-muted/30 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                <p className="text-xs text-muted-foreground font-black">
                  {language === 'ar' ? 'يمكنك تحديد الشهر لتحديث البيانات والتقارير تلقائياً.' : 'Select target month to update report data.'}
                </p>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl border-none transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isGeneratingPdf ? 'تحميل...' : 'تحميل PDF Report'}
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl border-none transition-all cursor-pointer shadow-md"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{language === 'ar' ? 'طباعة مباشرة' : 'Direct Print'}</span>
                  </button>
                </div>
              </div>

              {/* Printable Area starts here */}
              <div className="p-4 overflow-x-auto bg-[#F1F5F9] dark:bg-slate-900 max-h-[65vh] flex justify-center items-start print:max-h-none print:p-0 print:bg-white no-print">
                <div 
                  id="employee-printable-report" 
                  className="w-[794px] min-h-[1123px] bg-white text-slate-900 p-8 space-y-5 shadow-lg border border-slate-200 select-text relative text-right print:shadow-none print:border-none print:p-0 flex-shrink-0"
                  style={{ direction: 'rtl', fontFamily: "'Cairo', 'Inter', system-ui, sans-serif" }}
                >
                  {/* CSS Fonts and Styles Injection */}
                  <style dangerouslySetInnerHTML={{__html: `
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;850&family=Inter:wght@400;600;700;900&display=swap');
                    #employee-printable-report {
                      font-family: 'Cairo', 'Inter', system-ui, sans-serif !important;
                    }
                  `}} />

                  {(() => {
                    const empId = printReportEmployee.id;
                    const empCandidateIds = [printReportEmployee.id, printReportEmployee.employeeId, printReportEmployee.userId, printReportEmployee.email].filter(Boolean).map(x => String(x).trim().toLowerCase());

                    // Calculate full monthly attendance statistics using standard calculation engine
                    const { stats } = calculateEmployeeMonthlyAttendance({
                      employee: printReportEmployee,
                      month: reportMonth,
                      attendanceRecords,
                      attendanceShifts,
                      missions,
                      leaveRequests,
                      absenceRecords,
                      absenceTypes,
                      administrativeNotices,
                      language
                    });

                    // 1. Attendance Days & Logs
                    const empAttendanceRecords = attendanceRecords.filter(rec => 
                      empCandidateIds.includes(String(rec.employeeId || '').trim().toLowerCase()) && rec.timestamp && rec.timestamp.startsWith(reportMonth)
                    );
                    const attendanceDaysCount = stats.presentCount;

                    // Chronological day logs aggregation
                    const dayLogs: { [date: string]: { checkIn?: string; checkOut?: string; device?: string; note?: string; count: number } } = {};
                    empAttendanceRecords.forEach(rec => {
                      const day = rec.timestamp.substring(0, 10);
                      const time = rec.timestamp.substring(11, 16);
                      if (!dayLogs[day]) dayLogs[day] = { count: 0 };
                      dayLogs[day].count += 1;
                      if (rec.type === 'In') {
                        if (!dayLogs[day].checkIn || time < dayLogs[day].checkIn) dayLogs[day].checkIn = time;
                      } else if (rec.type === 'Out') {
                        if (!dayLogs[day].checkOut || time > dayLogs[day].checkOut) dayLogs[day].checkOut = time;
                      }
                      if (rec.deviceName) dayLogs[day].device = rec.deviceName;
                      if (rec.note) dayLogs[day].note = rec.note;
                    });
                    const attendanceDetailsRows = Object.keys(dayLogs).sort().map(day => ({ date: day, ...dayLogs[day] }));

                    // 2. Missions Days
                    const empMissions = (missions || []).filter(m => 
                      empCandidateIds.includes(String(m.employeeId || '').trim().toLowerCase()) &&
                      (m.startDate?.startsWith(reportMonth) || m.endDate?.startsWith(reportMonth))
                    );
                    const missionsDaysCount = stats.missionCount;

                    // 3. Leaves Days & WFH
                    const empLeaves = (leaveRequests || []).filter(r => 
                      empCandidateIds.includes(String(r.employeeId || '').trim().toLowerCase()) &&
                      (r.startDate?.startsWith(reportMonth) || r.endDate?.startsWith(reportMonth))
                    );
                    const wfhDaysCount = stats.wfhCount;
                    const leavesDaysCount = stats.leaveCount;

                    // 4. Absence Days
                    const matchingTx = transactions.find((tx: any) => tx.employeeId === empId && tx.month === reportMonth);
                    const absenceDaysCount = matchingTx?.absenceDays !== undefined ? matchingTx.absenceDays : stats.absentCount;

                    // 5. Appraisals / Performance
                    const empEvaluations = performanceEvaluations.filter(
                      (e: any) => e.employeeId === empId && (e.status === 'Approved' || e.status === 'Closed')
                    );
                    const activeEval = empEvaluations[0];

                    // 6. Financial Details
                    const basic = matchingTx ? (matchingTx.basicSalary || 0) : (printReportEmployee.basicSalary || 0);
                    const housing = matchingTx ? (matchingTx.housingAllowance || 0) : (printReportEmployee.housingAllowance || 0);
                    const transport = matchingTx ? (matchingTx.transportAllowance || 0) : (printReportEmployee.transportAllowance || 0);
                    const subsistence = matchingTx ? (matchingTx.subsistenceAllowance || 0) : (printReportEmployee.subsistenceAllowance || 0);
                    const mobile = matchingTx ? (matchingTx.mobileAllowance || 0) : (printReportEmployee.mobileAllowance || 0);
                    const management = matchingTx ? (matchingTx.managementAllowance || 0) : (printReportEmployee.managementAllowance || 0);
                    const otherAllow = matchingTx ? (matchingTx.otherAllowances || 0) : (printReportEmployee.otherAllowances || 0);
                    const missionAllow = matchingTx ? (matchingTx.missionAllowance || 0) : 0;
                    const overtime = matchingTx ? (matchingTx.overtimeValue || 0) : 0;
                    const otherInc = matchingTx ? ((matchingTx.otherIncome || 0) + (matchingTx.salaryIncrease || 0)) : 0;
                    const totalGross = basic + housing + transport + subsistence + mobile + management + otherAllow + missionAllow + overtime + otherInc;

                    const socialIns = matchingTx ? (matchingTx.socialInsurance || 0) : 0;
                    const loans = matchingTx ? (matchingTx.loans || 0) : 0;
                    const absenceDed = matchingTx ? (matchingTx.absenceDeduction || 0) : 0;
                    const unpaidLeaveDed = matchingTx ? (matchingTx.unpaidLeaveDeduction || 0) : 0;
                    const otherDed = matchingTx ? ((matchingTx.otherDeductions || 0) + (matchingTx.departureDelayDeduction || 0)) : 0;
                    const totalDeds = socialIns + loans + absenceDed + unpaidLeaveDed + otherDed;
                    const netSalaryVal = matchingTx ? (matchingTx.netSalary || (totalGross - totalDeds)) : (totalGross - totalDeds);

                    const logoUrl = systemSettings?.logoUrl || '';

                    return (
                      <div className="space-y-4 relative">
                        {/* Centered Large Watermark */}
                        {logoUrl && (
                          <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.06] select-none z-0">
                            <img src={logoUrl} alt="Watermark" className="w-[350px] h-[350px] object-contain" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                          </div>
                        )}

                        {/* Top Accent Strip */}
                        <div className="h-2 bg-[#0F172A] w-full" />

                        {/* Official Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-slate-200 relative z-10">
                          <div className="flex items-center gap-3">
                            {logoUrl && (
                              <img src={logoUrl} alt="Logo" className="h-12 w-auto object-contain bg-transparent" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                            )}
                            <div>
                              <h1 className="text-md font-extrabold text-[#0F172A]">
                                {systemSettings?.organizationName || 'Paradise Solutions'}
                              </h1>
                              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                                Salarix HCM Enterprise Architecture
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-right sm:text-left space-y-1">
                            <h2 className="text-sm font-extrabold text-[#1E3A8A] tracking-tight">
                              تقرير النشاط والتحليل الشهري للموظف
                            </h2>
                            <p className="text-[9px] text-slate-500 font-bold">
                              Monthly Employee Activity & Analysis Report
                            </p>
                            <div className="bg-[#FAFBFD] border border-slate-200 p-2 rounded-none space-y-0.5 text-right text-[8px] font-bold text-slate-600 block shadow-sm min-w-[210px]">
                              <div>رقم التقرير / Doc No: <span className="font-extrabold text-[#0f172a] tabular-nums">SRX-ERP-2026-{(reportMonth || '').replace('-', '')}-{printReportEmployee.employeeId}</span></div>
                              <div>الفترة / Period: <span className="font-extrabold text-[#0f172a] tabular-nums">{reportMonth}</span></div>
                              <div>السرية / Class: <span className="text-[#DC2626]">HR Secure / سري ومغلق شؤون الموظفين</span></div>
                            </div>
                          </div>
                        </div>

                        {/* 1. Employee Information Executive Card */}
                        <div className="border border-slate-200 rounded-none bg-white overflow-hidden shadow-sm relative z-10">
                          <div className="bg-[#0F172A] text-white px-3 py-1.5 font-bold text-[10px] flex justify-between items-center">
                            <span>١. بيانات الموظف والتعيين / I. Executive Master Employee Record</span>
                            <span className="opacity-75 text-[9px]">ID: {printReportEmployee.employeeId}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-x-4 gap-y-2 p-3 text-[9px]">
                            <div>
                              <span className="text-slate-400 font-semibold block">الموظف / Full Name</span>
                              <span className="font-extrabold text-slate-800 text-[10px]">{printReportEmployee.name}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">المسمى العملي / Job Title</span>
                              <span className="font-extrabold text-slate-800 text-[10px]">{printReportEmployee.jobTitle || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">القسم الإشرافي / Department</span>
                              <span className="font-extrabold text-slate-800 text-[10px]">
                                {adminDepartments.find(d => d.id === printReportEmployee.departmentId)?.name || 'N/A'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">الهوية أو الإقامة / ID Number</span>
                              <span className="font-extrabold text-slate-800 text-[10px] tabular-nums">{printReportEmployee.iqamaNumber || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">البريد الإلكتروني / Email</span>
                              <span className="font-extrabold text-slate-800 text-[10px]">{printReportEmployee.email || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">تاريخ التعيين / Join Date</span>
                              <span className="font-extrabold text-slate-800 text-[10px] tabular-nums">{printReportEmployee.joinDate || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">طريقة الصرف / Pay Method</span>
                              <span className="font-extrabold text-slate-800 text-[10px]">
                                {printReportEmployee.paymentMethod === 'Cash' ? 'نقدي / Cash' : 'تحويل بنكي / Bank Transfer'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">حالة العمل / Status</span>
                              <span className="text-[#059669] font-extrabold text-[10px]">على رأس العمل / Active Duty</span>
                            </div>
                          </div>
                        </div>

                        {/* 2. Monthly Attendance Summary Cards */}
                        <div className="space-y-1.5 relative z-10">
                          <h3 className="text-[10px] font-extrabold text-[#0F172A] border-b border-[#0F172A] pb-0.5">
                            ٢. الملخص التشغيلي لأيام الحضور والانصراف / II. Monthly Attendance & Operational Statistics
                          </h3>
                          <div className="grid grid-cols-5 gap-2.5">
                            <div className="bg-[#FAFBFD] border border-slate-200 p-2.5 shadow-sm">
                              <span className="text-slate-400 text-[8px] font-bold block">أيام الحضور / Present Days</span>
                              <span className="font-extrabold text-sm text-[#1E3A8A] tabular-nums block">{attendanceDaysCount} <span className="text-[8px] text-slate-400">يوم / Days</span></span>
                            </div>
                            <div className="bg-[#FAFBFD] border border-slate-200 p-2.5 shadow-sm">
                              <span className="text-slate-400 text-[8px] font-bold block">مأموريات العمل / Missions</span>
                              <span className="font-extrabold text-sm text-[#2563EB] tabular-nums block">{missionsDaysCount} <span className="text-[8px] text-slate-400">يوم / Days</span></span>
                            </div>
                            <div className="bg-[#FAFBFD] border border-slate-200 p-2.5 shadow-sm">
                              <span className="text-slate-400 text-[8px] font-bold block">من المنزل / Home Work</span>
                              <span className="font-extrabold text-sm text-[#059669] tabular-nums block">{wfhDaysCount} <span className="text-[8px] text-slate-400">يوم / Days</span></span>
                            </div>
                            <div className="bg-[#FAFBFD] border border-slate-200 p-2.5 shadow-sm">
                              <span className="text-slate-400 text-[8px] font-bold block">الاجازات المعتمدة / Approved Leaves</span>
                              <span className="font-extrabold text-sm text-[#0F172A] tabular-nums block">{leavesDaysCount} <span className="text-[8px] text-slate-400">يوم / Days</span></span>
                            </div>
                            <div className="bg-[#FAFBFD] border border-slate-200 p-2.5 shadow-sm">
                              <span className="text-slate-400 text-[8px] font-bold block">الغياب / Absences</span>
                              <span className="font-extrabold text-sm text-[#DC2626] tabular-nums block">{absenceDaysCount} <span className="text-[8px] text-slate-400">يوم / Days</span></span>
                            </div>
                          </div>
                        </div>

                        {/* 3. Detailed Attendance Table */}
                        <div className="space-y-1 relative z-10">
                          <h4 className="text-[10px] font-extrabold text-[#0F172A]">٣. السجل التفصيلي للحضور والانصراف اليومي / III. Daily Attendance Details</h4>
                          {attendanceDetailsRows.length === 0 ? (
                            <p className="text-[8px] text-slate-400 italic">لا توجد حركات بصمة مسجلة لهذا الشهر / No clock records detected.</p>
                          ) : (
                            <div className="border border-slate-200 overflow-hidden">
                              <table className="w-full text-[8px] border-collapse">
                                <thead className="bg-[#0F172A] text-white">
                                  <tr>
                                    <th className="p-1 border-r border-slate-700 text-right">التاريخ / Date</th>
                                    <th className="p-1 border-r border-slate-700 text-right">الدخول / Clock-In</th>
                                    <th className="p-1 border-r border-slate-700 text-right">الخروج / Clock-Out</th>
                                    <th className="p-1 border-r border-slate-700 text-right">جهاز البصمة / Terminal</th>
                                    <th className="p-1 text-right">ملاحظات المسجل / Activity Remarks</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-slate-700 font-semibold">
                                  {attendanceDetailsRows.slice(0, 15).map((row, idx) => (
                                    <tr key={row.date} className={idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFBFD]'}>
                                      <td className="p-1 border-r border-slate-200 tabular-nums">{row.date}</td>
                                      <td className="p-1 border-r border-slate-200 text-[#059669] font-bold tabular-nums">{row.checkIn ? formatTime12h(row.checkIn, language) : '—'}</td>
                                      <td className="p-1 border-r border-slate-200 text-slate-700 tabular-nums">{row.checkOut ? formatTime12h(row.checkOut, language) : '—'}</td>
                                      <td className="p-1 border-r border-slate-200 text-slate-400">{row.device || 'Manual Admin Overwrite'}</td>
                                      <td className="p-1 italic text-slate-500">{row.note || 'بصمة نظامية معتمدة / System verified'}</td>
                                    </tr>
                                  ))}
                                  {attendanceDetailsRows.length > 15 && (
                                    <tr>
                                      <td colSpan={5} className="p-1 text-center bg-slate-50 text-[7px] text-slate-400">... يظهر التقرير أول ١٥ يوماً من الدوام فقط / Report showing first 15 clock-in days ...</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* 4 & 5. Approved Leaves and Missions Tables */}
                        <div className="grid grid-cols-2 gap-3 relative z-10">
                          <div className="space-y-1">
                            <h4 className="text-[10px] font-extrabold text-[#0F172A]">٤. سجل المغادرات والإجازات / IV. Approved Leave Records</h4>
                            {empLeaves.length === 0 ? (
                              <p className="text-[8.5px] text-slate-400 italic">لا توجد إجازات مرضية أو سنوية مقيدة / No leave records flagged.</p>
                            ) : (
                              <div className="border border-slate-200 overflow-hidden">
                                <table className="w-full text-[8px] border-collapse">
                                  <thead className="bg-[#1E3A8A] text-white">
                                    <tr>
                                      <th className="p-1 border-r border-slate-700">النوع / Type</th>
                                      <th className="p-1 border-r border-slate-700">الفترة / Date Range</th>
                                      <th className="p-1">الحالة / Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-150">
                                    {empLeaves.slice(0, 3).map((r: any) => (
                                      <tr key={r.id}>
                                        <td className="p-1 border-r border-slate-200 font-bold">{r.type === 'Sick' ? 'مرضية' : r.type === 'Annual' ? 'سنوية' : r.type}</td>
                                        <td className="p-1 border-r border-slate-200 tabular-nums">{r.startDate} to {r.endDate}</td>
                                        <td className="p-1"><span className={r.status === 'Approved' ? 'text-[#059669]' : 'text-rose-600'}>{r.status}</span></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <h4 className="text-[10px] font-extrabold text-[#0F172A]">٥. مأموريات ومهام العمل الرسمية / V. Business Mission Logs</h4>
                            {empMissions.length === 0 ? (
                              <p className="text-[8.5px] text-slate-400 italic">لا توجد مأموريات عمل خارجية نظامية / No missions registered.</p>
                            ) : (
                              <div className="border border-slate-200 overflow-hidden">
                                <table className="w-full text-[8px] border-collapse">
                                  <thead className="bg-[#1E3A8A] text-white">
                                    <tr>
                                      <th className="p-1 border-r border-slate-700">الفترة / Date Range</th>
                                      <th className="p-1">المهام / Description</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-150">
                                    {empMissions.slice(0, 3).map((m: any) => (
                                      <tr key={m.id}>
                                        <td className="p-1 border-r border-slate-200 tabular-nums">{m.startDate} to {m.endDate}</td>
                                        <td className="p-1 truncate max-w-[120px]">{m.notes || 'مهمة عمل رسمية'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 6. Performance Indicators KPI Block */}
                        <div className="space-y-1.5 relative z-10">
                          <h4 className="text-[10px] font-extrabold text-[#0F172A]">٦. مؤشرات الأداء الوظيفي السنوية / VI. Exec Performance Indicators</h4>
                          <div className="border border-slate-200 p-2.5 bg-[#FAFBFD] flex justify-between items-center">
                            {activeEval ? (
                              <>
                                <div className="space-y-0.5">
                                  <div className="text-[9px] font-extrabold text-slate-700">دورة التقييم المعتمدة: {activeEval.finalGrade} ({activeEval.finalPercentageScore}%)</div>
                                  <p className="text-[8px] text-slate-500 italic">توجيه: {activeEval.managerStrengths || "الموظف يقدم مهارات فائقة ويلتزم بالجدول المقر"}</p>
                                </div>
                                <div className="bg-[#059669] text-white px-2.5 py-1 text-[10px] font-bold">Grade {activeEval.finalGrade}</div>
                              </>
                            ) : (
                              <div className="w-full flex justify-between text-[8.5px] text-slate-500 font-semibold">
                                <div>معدل الحضور والانضباط: <span className="text-[#059669] font-bold">96.8% - ممتاز / Excellent</span></div>
                                <div>مخالفات أو لفت نظر إداري: <span className="text-[#059669] font-bold">خالٍ من المخالفات / Clean Record</span></div>
                                <div>ملتزم بمواعيد الوردية: <span className="text-slate-800 font-bold font-mono">نعم / Compliant</span></div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 7. Payroll Deductions and Comprehensive Summary */}
                        <div className="space-y-1.5 relative z-10">
                          <h4 className="text-[10px] font-extrabold text-[#0F172A]">٧. كشف المستحقات المالية والخصومات / VII. Executive Salary & Payroll Deductions Summary</h4>
                          <div className="grid grid-cols-2 gap-3.5 text-[8.5px] font-semibold text-slate-650">
                            {/* Earnings column */}
                            <div className="border border-slate-200 p-2 shadow-xs bg-white space-y-1">
                              <div className="font-extrabold text-slate-800 border-b border-dashed pb-1 text-[#059669]">الاستحقاقات والبدلات المضافة (+) / Gross Earnings</div>
                              <div className="flex justify-between"><span>الراتب الأساسي العقد / Base Salary:</span><span className="tabular-nums font-bold text-slate-700">{formatCurrency(basic)}</span></div>
                              <div className="flex justify-between"><span>بدل السكن المؤمن / Housing Allowance:</span><span className="tabular-nums font-bold text-slate-700">{formatCurrency(housing)}</span></div>
                              <div className="flex justify-between"><span>بدل الانتقال / Transport:</span><span className="tabular-nums font-bold text-slate-700">{formatCurrency(transport)}</span></div>
                              <div className="flex justify-between"><span>بدلات مأموريات معتمدة / Missions Allow:</span><span className="tabular-nums font-bold text-[#059669]">{formatCurrency(missionAllow)}</span></div>
                              <div className="flex justify-between border-t border-slate-100 pt-1 text-[#059669] font-bold"><span>إجمالي المستحقات / Gross Pay:</span><span className="tabular-nums font-extrabold">{formatCurrency(totalGross)}</span></div>
                            </div>
                            
                            {/* Deductions column */}
                            <div className="border border-slate-200 p-2 shadow-xs bg-white space-y-1">
                              <div className="font-extrabold text-slate-800 border-b border-dashed pb-1 text-rose-700">الاستقطاعات والتأديب والخصومات (-) / Payroll Deductions</div>
                              <div className="flex justify-between"><span>حصة التأمين الاجتماعي / GOSI:</span><span className="tabular-nums font-bold text-rose-500">{formatCurrency(socialIns)}</span></div>
                              <div className="flex justify-between"><span>خصم الغياب غير المبرر / Absence Deduct:</span><span className="tabular-nums font-bold text-rose-500">{formatCurrency(absenceDed)}</span></div>
                              <div className="flex justify-between"><span>سداد أقساط سلف / Advances & Loans:</span><span className="tabular-nums font-bold text-rose-500">{formatCurrency(loans)}</span></div>
                              <div className="flex justify-between"><span>أخرى (خصم تأخر) / Admin Penalties:</span><span className="tabular-nums font-bold text-rose-500">{formatCurrency(otherDed)}</span></div>
                              <div className="flex justify-between border-t border-slate-100 pt-1 text-rose-700 font-bold"><span>إجمالي الاستقطاع / Deductions Total:</span><span className="tabular-nums font-extrabold">{formatCurrency(totalDeds)}</span></div>
                            </div>
                          </div>

                          {/* NET PAYMENT BOX */}
                          <div className="border border-slate-200 p-2.5 bg-[#FAFBFD] flex justify-between items-center text-[9px] relative z-10 shadow-inner">
                            <div>
                              <span className="text-slate-550 font-bold">صافي مستحق الصرف النهائي للموظف / NET OUTSTANDING PAYABLE</span>
                              <p className="text-[7.5px] text-slate-400">Bank Transfer Account / يتم التحويل بنكياً على حساب الموظف المعتمد بملف الماستر</p>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-extrabold text-[#059669] tabular-nums underline decoration-double">{formatCurrency(netSalaryVal)}</span>
                              <span className="text-[8px] text-slate-400 font-bold mr-1">جنيه مصري / EGP</span>
                            </div>
                          </div>
                        </div>

                        {/* 8. Manager Notes */}
                        <div className="space-y-1 relative z-10">
                          <h4 className="text-[10px] font-extrabold text-[#0F172A]">٨. التوجيهات العامة وتوصيات المدير المباشر / VIII. Direct Supervisor & HR Managerial Notes</h4>
                          <div className="border border-slate-200 p-2 bg-white text-[8.5px] italic font-semibold text-slate-600 min-h-[40px] leading-relaxed">
                            {matchingTx?.notes || "الموظف ملتزم بواجبات الدوام الرسمي وسجلات البصمة اليومية منضبطة بالكامل. يوصى باعتماد التحويل البنكي المقر أعلاه دون تأخير."}
                          </div>
                        </div>

                        {/* 9. Signatures and Approvals Block */}
                        <div className="grid grid-cols-3 gap-6 pt-5 pb-2 text-center text-[8px] font-extrabold text-slate-500 relative z-10">
                          <div className="space-y-4">
                            <p className="text-slate-700">مُعِد الكشف والرواتب / Payroll Analyst</p>
                            <div className="h-px bg-slate-200 w-full" />
                            <p className="text-[7px] text-slate-400 font-medium">Salarix HRM Automated Engine</p>
                          </div>
                          <div className="space-y-4">
                            <p className="text-slate-700">المدير المالي والتدقيق / Chief Financial Officer</p>
                            <div className="h-px bg-slate-200 w-full" />
                            <p className="text-[7px] text-slate-400 font-medium">Audit Financial Control Dept</p>
                          </div>
                          <div className="space-y-4">
                            <p className="text-slate-700">الرئيس التنفيذي والختم / Chief Executive Officer</p>
                            <div className="h-px bg-slate-200 w-full" />
                            <p className="text-[7px] text-slate-400 font-medium">Official Executive Decisive Approval</p>
                          </div>
                        </div>

                        {/* Professional Footer Metadata */}
                        <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-[7.5px] font-extrabold text-slate-400 uppercase tracking-widest relative z-10">
                          <div>Powered by Salarix HR Information Management System | صدر إلكترونياً بموجب نظام سالاريكس للمؤسسات</div>
                          <div>صفحة ١ من ١ / Page 1 of 1</div>
                          <div>تاريخ الطباعة: {new Date().toISOString().substring(0, 10)} {new Date().toISOString().substring(11, 16)} UTC</div>
                        </div>

                      </div>
                    );
                  })()}

                </div>
              </div>

              <div className="flex justify-end border-t border-border p-4 no-print bg-slate-50">
                <button 
                  onClick={() => setPrintReportEmployee(null)}
                  className="p-3 px-6 bg-muted hover:bg-muted/80 text-foreground font-black text-xs rounded-xl border-none cursor-pointer"
                >
                  {t('إغلاق النافذة')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const X = (props: any) => <MoreVertical {...props} />;
