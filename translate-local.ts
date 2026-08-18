import fs from 'fs';
import path from 'path';

// Define a deep, comprehensive dictionary of exact phrases and common words
const phraseDictionary: Record<string, string> = {
  // Self Service Dashboard
  "لوحة الخدمات الذاتية للموظف": "Employee Self-Service Dashboard",
  "الخدمات الذاتية": "Self-Service",
  "مرحباً بك مجدداً": "Welcome back",
  "الصفحة الرئيسية": "Home Page",
  "إجمالي الراتب": "Total Gross Salary",
  "الحركات المالية الأخيرة": "Recent Financial Transactions",
  "تقديم طلب": "Submit Request",
  "رصيد الإجازات المتاح": "Available Leave Balance",
  "الإجازات القادمة": "Upcoming Leaves",
  "طلبات المأموريات": "Mission Requests",
  "مأموريات العمل المستمرة": "Ongoing Work Missions",
  "سجل الحضور اليومي": "Daily Attendance Log",
  "تسجيل الحضور": "Check-In",
  "تسجيل الانصراف": "Check-Out",
  "اضغط لتسجيل حضورك اليوم": "Click to register your attendance today",
  "اضغط لتسجيل انصرافك اليوم": "Click to register your check-out today",
  "نشط حالياً": "Currently Active",
  "خارج العمل": "Offline / Outside Work",
  "إحصائيات الشهر الحالي": "Current Month Statistics",
  "ساعات العمل الفعلية": "Actual Working Hours",
  "ساعات التأخير": "Delay Hours",
  "الانصراف المبكر": "Early Departures",
  "أيام الغياب": "Absence Days",
  "أيام الحضور": "Attendance Days",

  // Time & Commitments Management
  "إدارة الوقت والالتزامات": "Time & Commitments Management",
  "مصفوفة أيزنهاور لتنظيم المهام": "Eisenhower Matrix Task Organizer",
  "عرض التقويم": "Calendar View",
  "الالتزامات المجدولة": "Scheduled Commitments",
  "إضافة التزام جديد": "Add New Commitment",
  "عاجل وهام - افعل الآن": "Urgent & Important - Do First",
  "هام وغير عاجل - خطط له": "Important & Not Urgent - Schedule",
  "عاجل وغير هام - فوضه": "Urgent & Not Important - Delegate",
  "غير عاجل وغير هام - تخلص منه": "Not Urgent & Not Important - Eliminate",
  "لا توجد التزامات مجدولة لهذا اليوم": "No scheduled commitments for today",
  "تفاصيل الالتزام": "Commitment Details",
  "تاريخ البدء": "Start Date",
  "تاريخ الانتهاء": "End Date",
  "الأولوية": "Priority",
  "عالية جداً": "Critical / Critical High",
  "عالية": "High",
  "متوسطة": "Medium",
  "منخفضة": "Low",
  "تم الإنجاز": "Mark Completed",
  "قيد الإجراء": "In Progress / Pending",
  "الساعات المخطط لها": "Planned Hours",
  "الساعات الفعلية": "Actual Hours",

  // System & User Security
  "إعدادات الأمان والصلاحيات": "Security Settings & Permissions",
  "إدارة حسابات ومستخدمي النظام": "System Users & Accounts Management",
  "تعديل صلاحيات الحساب": "Edit Account Permissions",
  "الأدوار الوظيفية": "User Roles",
  "سجل العمليات والرقابة": "Security Audit Log",
  "مستوى الأمان": "Security Level",
  "تغيير كلمة المرور": "Change Password",
  "قفل الحساب": "Lock Account",
  "تنشيط الحساب": "Activate Account",
  "حالة الحساب": "Account Status",
  "مستخدم فعال": "Active User",
  "مستخدم معطل": "Disabled User",
  "إضافة حساب جديد": "Add New Account",
  "صلاحية كاملة": "Full Access Permission",
  "صلاحية عرض فقط": "Read-Only Permission",
  "البريد الإلكتروني": "Email Address",

  // Operations Dashboard & Department
  "لوحة تحكم التشغيل": "Operations Dashboard",
  "إدارة التشغيل": "Operations Management",
  "مهامي الشخصية": "My Personal Tasks",
  "قسم العمليات": "Operations Department",
  "المشاريع الحالية": "Active Projects",
  "إنشاء مشروع جديد": "Create New Project",
  "حالة المشروع": "Project Status",
  "أعضاء الفريق": "Team Members",
  "تعديل بيانات المشروع": "Edit Project Details",
  "حذف المشروع": "Delete Project",
  "المهام المعلقة": "Pending Tasks",
  "المهام المكتملة": "Completed Tasks",
  "لوحة المهام (Kanban)": "Task Kanban Board",
  "أولوية المهمة": "Task Priority",
  "المسؤول عن التنفيذ": "Assigned To",
  "معدل الإنجاز": "Completion Rate",

  // HR Dashboard & Structure
  "لوحة تحكم الموارد البشرية": "HR Dashboard",
  "إدارة الموارد البشرية": "HR Management",
  "الهيكل الإداري": "Administrative Structure",
  "الموظفين": "Employees List",
  "إضافة موظف جديد": "Add New Employee",
  "تحديث بيانات موظف": "Update Employee Data",
  "بيانات الموظف": "Employee Personal Data",
  "الاسم الكامل": "Full Name",
  "الرقم الوظيفي": "Employee ID",
  "المسمى الوظيفي": "Job Title",
  "القسم / الإدارة": "Department / Administration",
  "تاريخ التعيين": "Date of Joining",
  "الراتب الأساسي": "Basic Salary",
  "بدل السكن": "Housing Allowance",
  "بدل المواصلات": "Transportation Allowance",
  "بدلات أخرى": "Other Allowances",
  "رقم الحساب البنكي (IBAN)": "IBAN Account Number",
  "اسم البنك": "Bank Name",
  "الهيكل التنظيمي": "Org Chart",

  // Attendance
  "إدارة الحضور والانصراف": "Attendance Management & Logs",
  "سجل الحضور العام": "General Attendance Records",
  "جلب بيانات اليوم": "Fetch Today's Data",
  "تصدير التقارير": "Export Reports",
  "تقرير الحضور والغياب": "Attendance & Absence Report",
  "وقت الحضور": "Check-In Time",
  "وقت الانصراف": "Check-Out Time",
  "تأخير بالدقائق": "Delay (Minutes)",
  "خروج مبكر بالدقائق": "Early Out (Minutes)",
  "موقع البصمة": "Verification Location",
  "طريقة تسجيل الحضور": "Check-In Method",

  // Smart Missions Management
  "إدارة المأموريات الذكية": "Smart Missions Management",
  "طلب مأمورية جديدة": "Submit New Work Mission",
  "مأمورية خارجية": "External Business Mission",
  "مأمورية داخلية": "Internal Business Mission",
  "وجهة المأمورية": "Mission Destination",
  "الغرض من المأمورية": "Mission Purpose / Goals",
  "بدل المأمورية اليومي": "Daily Mission Allowance",
  "الموافقة على المأمورية": "Approve Work Mission",
  "رفض المأمورية": "Reject Work Mission",

  // Leave Requests
  "إدارة طلبات الإجازات": "Leave Requests Management",
  "تقديم طلب إجازة رسمي": "Submit Official Leave Request",
  "نوع الإجازة": "Leave Type",
  "إجازة اعتيادية": "Annual Leave",
  "إجازة سنوية": "Annual Leave",
  "إجازة مرضية": "Sick Leave",
  "إجازة اضطرارية": "Emergency Leave",
  "إجازة بدون راتب": "Unpaid Leave",
  "سبب الإجازة": "Leave Reason",

  // Administrative Violations and Penalties
  "إدارة المخالفات والجزاءات الإدارية": "Administrative Violations and Penalties",
  "جدول المخالفات المعتمد": "Approved Violations Matrix",
  "رصد مخالفة جديدة": "Record New Violation",
  "المخالفة الإدارية": "Administrative Violation",
  "نوع العقوبة المطبقة": "Applied Penalty Type",
  "الجزاء المترتب": "Deduction / Penalty Amount",
  "إنذار كتابي": "Written Warning Letter",
  "خصم يوم واحد": "One Day Deduction",
  "خصم يومين": "Two Days Deduction",
  "خصم ثلاثة أيام": "Three Days Deduction",
  "لفت نظر إداري": "Official Written Warning",
  "إنذار نهائي شديد اللهجة": "Severe Final Warning",
  "خصم مالي مباشر": "Direct Financial Penalty",

  // Allowance Types & Transactions
  "أنواع البدلات والتعويضات": "Allowance Types & Compensations",
  "إضافة نوع بدل جديد": "Create New Allowance Type",
  "الحركات الشهرية العامة": "Monthly Transactions",
  "اعتماد الحركات المالية": "Approve Payroll Transactions",
  "قفل الحسابات الختامية": "Lock Final Payroll Accounts",
  "مسير بدلات المأموريات": "Mission Allowance Runs",
  "مسير بدلات المأموريات المعتمد": "Approved Mission Allowance Run",
  "سلف ومقدمات المأموريات المالية": "Mission Financial Advances",
  "تقديم سلفة لمأمورية": "Request Financial Advance",

  // Settings & Filtration
  "تصفية البيانات الذكية": "Smart Data Filtration",
  "إعدادات المنشأة والشركة": "Organization & Company Settings",
  "اسم المنشأة باللغة العربية": "Organization Name (Arabic)",
  "اسم المنشأة باللغة الإنجليزية": "Organization Name (English)",
  "الرقم الضريبي": "Tax Identification Number (TIN)",
  "السجل التجاري": "Commercial Registration (CR)",
  "تطبيق القوانين": "Apply Regulatory Policies",
  "إعدادات شبكات ومواقع الحضور": "Attendance Locations and Networks Settings",
  "إيجاد وتحديث الموقع الجغرافي": "Find & Update GPS Location",
  "التحقق الجغرافي": "GPS Verification",
  "نطاق التحقق المسموح": "Allowed Verification Radius (Meters)",

  // Common Action Buttons & Placeholders
  "الصفحة التالية": "Next Page",
  "الصفحة السابقة": "Previous Page",
  "لا توجد بيانات متاحة": "No data available",
  "يرجى تحديد الخيار": "Please select option",
  "تفاصيل إضافية": "Additional details",
  "الرجاء الانتظار": "Please wait...",
  "تمت العملية بنجاح": "Operation completed successfully",
  "فشل تنفيذ الطلب": "Operation failed to execute"
};

// Common individual words dictionary for dynamic split-translation helper
const wordDictionary: Record<string, string> = {
  "إدارة": "Management",
  "الموظفين": "Employees",
  "الحركات": "Transactions",
  "الرواتب": "Payroll",
  "الحضور": "Attendance",
  "الانصراف": "Check-out",
  "المأموريات": "Missions",
  "الهيكل": "Structure",
  "الإداري": "Administrative",
  "التنظيمي": "Organizational",
  "البدلات": "Allowances",
  "تصفية": "Settlements",
  "المستخدمين": "Users",
  "الصلاحيات": "Permissions",
  "الأمان": "Security",
  "العمليات": "Operations",
  "الشخصية": "Personal",
  "التشغيل": "Operations",
  "الموارد": "Resources",
  "البشرية": "Human",
  "الذاتية": "Self-Service",
  "المستندات": "Documents",
  "العقود": "Contracts",
  "التقارير": "Reports",
  "جديد": "New",
  "إضافة": "Add",
  "حفظ": "Save",
  "تعديل": "Edit",
  "تحديث": "Update",
  "حذف": "Delete",
  "إلغاء": "Cancel",
  "موافق": "OK",
  "تأكيد": "Confirm",
  "عرض": "View",
  "بحث": "Search",
  "الاسم": "Name",
  "العنوان": "Title / Address",
  "البريد": "Email",
  "الإلكتروني": "Electronic",
  "الهاتف": "Phone",
  "الجوال": "Mobile",
  "المنشأة": "Organization",
  "الفرع": "Branch",
  "القسم": "Department",
  "المسمى": "Title",
  "الوظيفي": "Job",
  "الحالة": "Status",
  "التاريخ": "Date",
  "الوصف": "Description",
  "القيمة": "Value",
  "الإجمالي": "Total",
  "الصافي": "Net",
  "الخصومات": "Deductions",
  "الضرائب": "Taxes",
  "التأمينات": "Insurance",
  "الاجتماعية": "Social",
  "السكن": "Housing",
  "النقل": "Transportation",
  "الأقسام": "Departments",
  "الفروع": "Branches",
  "الصادر": "Outgoing",
  "الوارد": "Incoming",
  "المشروع": "Project",
  "المشاريع": "Projects",
  "المهمة": "Task",
  "المهام": "Tasks",
  "الإجراءات": "Actions",
  "نشط": "Active",
  "معطل": "Disabled",
  "فعال": "Active",
  "مسودة": "Draft",
  "تحت": "Under",
  "الطلب": "Request",
  "تم": "Done",
  "القبول": "Approved",
  "الرفض": "Rejected",
  "معتمد": "Approved",
  "مرفوض": "Rejected",
  "مغلق": "Locked",
  "قفل": "Lock",
  "فشل": "Failed",
  "نجاح": "Success",
  "خطأ": "Error",
  "رسالة": "Message",
  "تنبيه": "Alert / Warning",
  "ملاحظة": "Note",
  "اليوم": "Today",
  "الشهر": "Month",
  "السنة": "Year",
  "الأسبوع": "Week",
  "ساعة": "Hour",
  "دقيقة": "Minute",
  "يوم": "Day",
  "أيام": "Days",
  "ساعات": "Hours"
};

// Smart fallback translator
function translateString(ar: string): string {
  ar = ar.trim();

  // 1. Direct match in phrase dictionary
  if (phraseDictionary[ar]) {
    return phraseDictionary[ar];
  }

  // Look for sub-phrase matches
  for (const [key, val] of Object.entries(phraseDictionary)) {
    if (ar.toLowerCase() === key.toLowerCase() || ar.replace(/[⚠️💡📝📎🛑]/g, '').trim() === key) {
      return val;
    }
  }

  // 2. Contains static Latin terms inside (like English in parentheses)
  const englishInParentheses = ar.match(/\(([^)]+)\)/);
  if (englishInParentheses && /^[a-zA-Z\s\-_0-9]+$/.test(englishInParentheses[1].trim())) {
    return englishInParentheses[1].trim();
  }

  // 3. Fallback: Split and translate word-by-word, keeping formatting
  const words = ar.split(/[\s،؛؟!\.\-:\(\)/]+/);
  const translatedWords = words.map(word => {
    const cleanWord = word.replace(/^[«“"'‘`(]+|[»”"'’`)]+$/g, '');
    if (!cleanWord || /^[a-zA-Z0-9]+$/.test(cleanWord)) return word; // Keep English or numbers
    const trans = wordDictionary[cleanWord];
    return trans || word;
  });

  // Rebuild the string beautifully
  const isAllTranslated = translatedWords.every((tw, idx) => {
    // If it equals original ar word or clean versions and it is Arabic, then we missed a word
    return tw !== words[idx] || !/[\u0600-\u06FF]/.test(tw);
  });

  if (isAllTranslated) {
    // Capitalize properly
    return translatedWords
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 4. Default dynamic fallback: make a clean uppercase label
  const latinKey = ar
    .replace(/[\u0600-\u06FF]/g, '')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .trim();

  if (latinKey && latinKey.length > 2) {
    return latinKey;
  }

  // Human-readable fallback using capitalized placeholders if everything else fails
  return ar;
}

function runLocalTranslate() {
  const arabicFile = path.join(process.cwd(), 'extracted_arabic.json');
  if (!fs.existsSync(arabicFile)) {
    console.error("extracted_arabic.json not found! Please run extract-arabic.ts first.");
    return;
  }

  const list: string[] = JSON.parse(fs.readFileSync(arabicFile, 'utf-8'));
  console.log(`Processing ${list.length} phrases locally...`);

  const translationsMap: Record<string, string> = {
    "نشط": "Active",
    "غير نشط": "Inactive",
    "قيد الانتظار": "Pending Approval",
    "معتمد": "Approved",
    "مرفوض": "Rejected",
    "مسودة": "Draft",
    "مرسل": "Submitted",
    "مقفل": "Locked",
    "مكتمل": "Completed",
    "إلغاء": "Cancel",
    "حفظ": "Save",
    "إضافة": "Add",
    "تعديل": "Edit",
    "حذف": "Delete",
    "موافق": "OK",
    "تأكيد": "Confirm",
    "فحص": "Check / Audit"
  };

  list.forEach(ar => {
    const cleanAr = ar.trim();
    if (!cleanAr || /^\d+$/.test(cleanAr)) return;
    translationsMap[ar] = translateString(ar);
  });

  fs.writeFileSync('translated_dictionary.json', JSON.stringify(translationsMap, null, 2), 'utf-8');
  console.log(`Successful local translation! Dictionary created with ${Object.keys(translationsMap).length} entries.`);
}

runLocalTranslate();
