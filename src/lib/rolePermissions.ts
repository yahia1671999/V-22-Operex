export interface SystemPermission {
  key: string;
  module: string;
  resource: string;
  action: string;
  arabicLabel: string;
  englishLabel: string;
  description: string;
  isDangerous: boolean;
  requiresEmployeeMapping: boolean;
  scope: 'own' | 'assigned' | 'department' | 'all';
}

export const SYSTEM_PERMISSIONS: SystemPermission[] = [
  // Admin module
  {
    key: 'admin.users.view',
    module: 'admin',
    resource: 'users',
    action: 'view',
    arabicLabel: 'عرض مستخدمي النظام وصلاحياتهم',
    englishLabel: 'View System Users',
    description: 'عرض قائمة مستخدمي النظام وصلاحياتهم الأساسية',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'admin.users.create',
    module: 'admin',
    resource: 'users',
    action: 'create',
    arabicLabel: 'إنشاء مستخدم جديد وبناء حسابه',
    englishLabel: 'Create System User',
    description: 'إضافة حسابات أمان ومستخدمين جدد للنظام وتوطيد كلمة المرور',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'admin.users.edit',
    module: 'admin',
    resource: 'users',
    action: 'edit',
    arabicLabel: 'تحديث صلاحيات وأدوار مستخدم',
    englishLabel: 'Edit User Roles & Permissions',
    description: 'تغيير البروفايل، الصلاحيات الفردية المباشرة، والأدوار الأمنية الخاصة بالحسابات',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'admin.users.delete',
    module: 'admin',
    resource: 'users',
    action: 'delete',
    arabicLabel: 'حذف أو إيقاف حساب مستخدم',
    englishLabel: 'Delete/Deactivate User Accounts',
    description: 'تعطيل الحساب الأمني ومنعه من تسجيل الدخول للنظام بالكامل لمنع التسريبات',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'admin.permissions.manage',
    module: 'admin',
    resource: 'permissions',
    action: 'manage',
    arabicLabel: 'إدارة وتفويض الصلاحيات للأدوار',
    englishLabel: 'Manage Roles & Direct Permissions',
    description: 'التحكم والتعديل في مصفوفة الصلاحيات الفردية والأدوار والتفويضات المشتركة',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'admin.organization_settings.manage',
    module: 'admin',
    resource: 'organization_settings',
    action: 'manage',
    arabicLabel: 'إدارة إعدادات المنشأة الحيوية',
    englishLabel: 'Manage Organization Settings',
    description: 'تعديل هوية المؤسسة، شعارها، معايير العمل، والربط البنكي والمصرفي للنظام',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'admin.wifi_settings.manage',
    module: 'admin',
    resource: 'wifi_settings',
    action: 'manage',
    arabicLabel: 'إدارة شبكات الحضور والواي فاي الذكي الجغرافي',
    englishLabel: 'Manage WiFi Attendance Networks',
    description: 'إضافة وتعديل عناوين IP، مجالات الربط وشروط البصومة الخلوية الجغرافية',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'admin.system_logs.view',
    module: 'admin',
    resource: 'system_logs',
    action: 'view',
    arabicLabel: 'الاطلاع على لوائح المراقبة والتدقيق الأمني',
    englishLabel: 'View Audit Trail & System Security Logs',
    description: 'تفتيش السجلات الأمنية والعمليات والمدخلات ومحاولات الفشل أو الاختراق',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'admin.security_settings.manage',
    module: 'admin',
    resource: 'security_settings',
    action: 'manage',
    arabicLabel: 'تهيئة جدران الحماية وإعدادات الأمان والتشفير',
    englishLabel: 'Manage Security Settings & Policies',
    description: 'التحكم بمعايير قفل الشاشات، مدة الجلسات، وقوة كلمات المرور المطلوبة',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'admin.notices.manage',
    module: 'admin',
    resource: 'notices',
    action: 'manage',
    arabicLabel: 'إدارة وتوجيه التنبيهات والقرارات الإدارية العليا',
    englishLabel: 'Manage Administrative Notices & Directives',
    description: 'إمكانية إضافة، تعديل، أرشفة ونشر القرارات الإدارية العليا وتعميمها على منسوبي الإدارات',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'admin.notices.view',
    module: 'admin',
    resource: 'notices',
    action: 'view',
    arabicLabel: 'عرض واستعراض سجل التنبيهات الإدارية',
    englishLabel: 'View Administrative Notices Log',
    description: 'عرض المراسلات والقرارات الإدارية المنشورة وتفاصيل الاستلام للعامة',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },

  // HR - Penalties & Violations
  {
    key: 'hr.penalties.view',
    module: 'hr',
    resource: 'penalties',
    action: 'view',
    arabicLabel: 'عرض ومتابعة سجل الجزاءات والمخالفات التأديبية',
    englishLabel: 'View Disciplinary Penalties & Violations',
    description: 'استعراض سجل المخالفات والجزاءات وقرارات الخصم الصادرة بحق الموظفين ومسارات اعتمادها',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.penalties.create',
    module: 'hr',
    resource: 'penalties',
    action: 'create',
    arabicLabel: 'تسجيل وإنشاء جزاء أو مخالفة إدارية جديدة',
    englishLabel: 'Create Disciplinary Penalty Record',
    description: 'توثيق مخالفة إدارية جديدة وتحديد نوع الجزاء (إنذار، لفت نظر، خصم أيام أو مبالغ)',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.penalties.edit',
    module: 'hr',
    resource: 'penalties',
    action: 'edit',
    arabicLabel: 'تعديل وتحديث بيانات قرار الجزاء والمخالفة',
    englishLabel: 'Edit Penalty & Violation Record',
    description: 'تعديل تفاصيل المخالفة وقيمة الخصم أو الملاحظات الإدارية والمرفقات',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.penalties.approve',
    module: 'hr',
    resource: 'penalties',
    action: 'approve',
    arabicLabel: 'اعتماد والموافقة على قرارات الجزاءات الإدارية',
    englishLabel: 'Approve/Authorize Disciplinary Penalties',
    description: 'موافقة واعتماد قرار الجزاء من قبل المدير المباشر أو الرئيس الأعلى أو الموارد البشرية وتطبيق الخصم المالي',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.penalties.delete',
    module: 'hr',
    resource: 'penalties',
    action: 'delete',
    arabicLabel: 'حذف أو إلغاء سجلات الجزاءات والمخالفات',
    englishLabel: 'Delete/Cancel Penalty Record',
    description: 'إلغاء أو حذف قرار جزاء إداري من النظام بشكل كامل وتوثيق سبب الإلغاء',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.penalties.grievance',
    module: 'hr',
    resource: 'penalties',
    action: 'grievance',
    arabicLabel: 'البت والمراجعة لتظلمات الجزاءات الإدارية',
    englishLabel: 'Review & Resolve Penalty Grievances',
    description: 'فحص التظلمات المقدمة من الموظفين وقبول التظلم أو تعديل وتخفيف الجزاء أو تثبيته',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },

  // HR - Investigations
  {
    key: 'hr.investigations.view',
    module: 'hr',
    resource: 'investigations',
    action: 'view',
    arabicLabel: 'عرض ومتابعة جلسات التحقيق الإداري',
    englishLabel: 'View Administrative Investigations',
    description: 'الاطلاع على جدول جلسات التحقيق الإداري والموظفين المستدعين والتوصيات الصادرة',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.investigations.manage',
    module: 'hr',
    resource: 'investigations',
    action: 'manage',
    arabicLabel: 'إدارة وجدولة جلسات وقرارات التحقيق الإداري',
    englishLabel: 'Manage Administrative Investigation Sessions',
    description: 'إنشاء وجدولة جلسات التحقيق، استدعاء الموظفين، تدوين التوصيات، وتعديل حالة الجلسة',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },

  // HR module
  {
    key: 'hr.dashboard.view',
    module: 'hr',
    resource: 'dashboard',
    action: 'view',
    arabicLabel: 'رؤية لوحة المتابعة والتحليلات للموارد البشرية',
    englishLabel: 'View HR Analytics Dashboard',
    description: 'الاطلاع على نسب غياب الموظفين ومعلومات التعاقدات والخدمات والنشاط اليومي للمنشأة',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.employees.view',
    module: 'hr',
    resource: 'employees',
    action: 'view',
    arabicLabel: 'عرض قائمة ومستندات الموظفين',
    englishLabel: 'View Employees Directory & Records',
    description: 'مشاهدة معلومات الموظفين الأساسية، رواتبهم، ومستنداتهم الحكومية والبنكية المرفقة',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.employees.create',
    module: 'hr',
    resource: 'employees',
    action: 'create',
    arabicLabel: 'تسجيل وبناء بروفايل موظفة/موظف جديد',
    englishLabel: 'Create New Employee Profiles',
    description: 'إدخال الهوية وأرقام التواصل والرواتب وبطاقة المسمى لتوظيف شخص جديد',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.employees.edit',
    module: 'hr',
    resource: 'employees',
    action: 'edit',
    arabicLabel: 'تحديث وتعديل مستندات وبيانات موظف',
    englishLabel: 'Edit Employee Information & Salaries',
    description: 'تغيير السلم الوظيفي، الرواتب والعهد وتبرير ملفات الموظفين الحاليين بالمنشأة',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.employees.delete',
    module: 'hr',
    resource: 'employees',
    action: 'delete',
    arabicLabel: 'إلغاء تفعيل وتثبيط حساب موظف بالنظام',
    englishLabel: 'Terminate/Deactivate Employee Records',
    description: 'أرشفة السجلات الأمنية لبروفايل الموظف المفسوخ عقده ومنع دخوله للنظام بالكامل',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.attendance.view',
    module: 'hr',
    resource: 'attendance',
    action: 'view',
    arabicLabel: 'الاطلاع العام على السجل اليومي لحضور المنشأة',
    englishLabel: 'View Personnel Attendance Records',
    description: 'تتبع الموظفين وتأخرهم والـ IP لدوامهم الجغرافي والورديات اليومية والمغادرات',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.attendance.create',
    module: 'hr',
    resource: 'attendance',
    action: 'create',
    arabicLabel: 'تسجيل وإجراء حضور/انصراف يدوي استثنائي للموظفين',
    englishLabel: 'Log Manual/Exceptional Attendance Entries',
    description: 'تسجيل حضور بديل للموظف في حالات النسيان أو العذر المقبول بدون إخلال ببيانات النظام المعيارية',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.attendance.edit',
    module: 'hr',
    resource: 'attendance',
    action: 'edit',
    arabicLabel: 'تعديل أو تبرير أخطاء الحضور والمغادرات اليومية',
    englishLabel: 'Adjust Attendance Logs & Excuses',
    description: 'إجراء تحديث على أوقات البصمات المققيدة أو تسجيل تبرير إداري وقبول تعديل الورديات',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.missions.view',
    module: 'hr',
    resource: 'missions',
    action: 'view',
    arabicLabel: 'عرض وفحص مأموريات العمل والزيارات الخارجية',
    englishLabel: 'View Department Missions Requests',
    description: 'استعراض مأموريات العمل والزيارات الفنية المهندسة لمنتسبي الشركة للمتابعة والتدقيق',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.missions.edit',
    module: 'hr',
    resource: 'missions',
    action: 'edit',
    arabicLabel: 'تعديل مصفوفة التكاليف والبدلات للمأموريات',
    englishLabel: 'Edit Mission Allowance & Cost Matrix',
    description: 'تعديل الفئات وقيم بدلات السفر والإقامة ومصفوفة تكاليف المأموريات للموظفين',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'mission.edit',
    module: 'hr',
    resource: 'missions',
    action: 'edit',
    arabicLabel: 'تعديل مصفوفة تكاليف المأموريات والبدلات',
    englishLabel: 'Edit Mission Allowance Matrix',
    description: 'إكانية تعديل بدلات السفر ومصفوفة التكاليف للمأموريات',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.missions.approve',
    module: 'hr',
    resource: 'missions',
    action: 'approve',
    arabicLabel: 'الاعتماد النهائي لمأمورية عمل للموظف وميزانياتها',
    englishLabel: 'Approve/Authorize External Missions',
    description: 'الموافقة على مأمورية عمل خارجية وصرف السلفة وتثبيتها بالحسابات الرسمية',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.missions.delete',
    module: 'hr',
    resource: 'missions',
    action: 'delete',
    arabicLabel: 'حذف مأمورية عمل',
    englishLabel: 'Delete External Mission Record',
    description: 'إزالة أو إلغاء مأمورية عمل من النظام بإنذار أمني',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.leaves.view',
    module: 'hr',
    resource: 'leaves',
    action: 'view',
    arabicLabel: 'مراقبة طلبات الإجازات وتقارير الغيابات الكلية لمنتسبي الشركة',
    englishLabel: 'View Employees Leave Applications',
    description: 'إظهار قائمة طلبات الإجازة وتدقيق التقارير الطبية والمستند المرفق وتبريرات الغياب',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.leaves.approve',
    module: 'hr',
    resource: 'leaves',
    action: 'approve',
    arabicLabel: 'الاعتماد النهائي والموافقة على طلبات إجازة غياب',
    englishLabel: 'Approve/Evaluate Leave Applications',
    description: 'إقرار بالرفض أو الموافقة على إجازات الموظفين ودمجها بخصم الرصيد السنوي المتوفر لهم',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.leaves.delete',
    module: 'hr',
    resource: 'leaves',
    action: 'delete',
    arabicLabel: 'حذف طلب إجازة',
    englishLabel: 'Delete Leave Request Application',
    description: 'مسح أو إلغاء طلب إجازة من النظام كلياً بإنذار أمني',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.admin_structure.view',
    module: 'hr',
    resource: 'admin_structure',
    action: 'view',
    arabicLabel: 'عرض البنيان الإداري ومحاور هيكلة الأقسام بالمؤسسة',
    englishLabel: 'View Administrative Structure Chart',
    description: 'رؤية القطاعات الوظيفية وتوزيع الأفراد على سلم المراتب بالنظام ERP',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.admin_structure.manage',
    module: 'hr',
    resource: 'admin_structure',
    action: 'manage',
    arabicLabel: 'إعادة تهيئة وتعديل الهيكل والقطاعات والأقسام',
    englishLabel: 'Manage Administrative Structure & Roles',
    description: 'تغيير مدرجات المناصب وإضافة أقسام جديدة، تعديل الرؤساء المباشرين والتحكم بمسارات التدفق',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.performance.view',
    module: 'hr',
    resource: 'performance',
    action: 'view',
    arabicLabel: 'عرض موديول تقييم الأداء والنمو المهني والمؤشرات',
    englishLabel: 'View Performance Appraisal & Metrics',
    description: 'الاطلاع على قائمة الموظفين وإحصائيات التقييم السنوي والشهري والمعايير المعتمدة لتقييم الأداء',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'hr.performance.manage',
    module: 'hr',
    resource: 'performance',
    action: 'manage',
    arabicLabel: 'إدارة موديول تقييم الأداء بالكامل',
    englishLabel: 'Manage All Performance Appraisals',
    description: 'صلاحية كاملة لإنشاء وتعديل وحذف دورات التقييم، وتصميم قوالب استمارات التقييم ومعايير السلوك والإنتاجية وإدارتها للموظفين المشمولين',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },

  // Payroll/Finance module
  {
    key: 'payroll.dashboard.view',
    module: 'payroll',
    resource: 'dashboard',
    action: 'view',
    arabicLabel: 'عرض مؤشرات ومسارات النفقات والأجور الشهرية الكلية للنظام',
    englishLabel: 'View Payroll & Financial Dashboard',
    description: 'تدقيق نفقات الرواتب، نسب التعديل والخصومات وتخطيط السيولة اللازمة',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.transactions.view',
    module: 'payroll',
    resource: 'transactions',
    action: 'view',
    arabicLabel: 'مشاهدة حركات الحسابات وتسجيلات السلف والبدلات ماليًا',
    englishLabel: 'View Earnings & Deductions Transactions',
    description: 'تتبع بنود الاستحقاق والاستقطاع المتنوعة وتدقيق مبالغ الزيادة الاستباقية للموظف قبل المسير',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.transactions.create',
    module: 'payroll',
    resource: 'transactions',
    action: 'create',
    arabicLabel: 'إدخال وتسجيل تسوية أو خصم مالي لموظف بالشركة',
    englishLabel: 'Insert Financial Adjustments & Bonuses',
    description: 'تسجيل خصم تأخر أو مكافأة خاصة كبدل مالي يدرج مباشرة بمسير الشهر الجاري',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.transactions.edit',
    module: 'payroll',
    resource: 'transactions',
    action: 'edit',
    arabicLabel: 'تعديل حركة بدل مالي مسجلة بقسم المعالجة المحاسبية',
    englishLabel: 'Edit Employee Financial Transactions',
    description: 'تصحيح قيمة خصم أو مبالغ البدلات المدرجة استعجالاً بالتسجيل وتحديث المدخلات قبل التقديم',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.transactions.delete',
    module: 'payroll',
    resource: 'transactions',
    action: 'delete',
    arabicLabel: 'إسقاط وحذف تسوية مالية أو بدل من السجلات ماليًا',
    englishLabel: 'Delete Financial Transactions',
    description: 'حذف حوافز أو حسم مالي كان مقيداً بالحسابات وتصغير الحسم لمنع حتمه في المسير المالي',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.runs.view',
    module: 'payroll',
    resource: 'runs',
    action: 'view',
    arabicLabel: 'عرض كشوفات ومسودات مسيرات الرواتب الشهرية الكلية المنفذة',
    englishLabel: 'View Monthly Payroll Run Records',
    description: 'مشاهدة مسيرات المعالجة الشهرية والتدفق الكلي لمسيرات الرواتب مع كروت البنك',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.runs.create',
    module: 'payroll',
    resource: 'runs',
    action: 'create',
    arabicLabel: 'توليد واحتساب مسير رواتب جديد بالمالية',
    englishLabel: 'Create New Monthly Payroll Run',
    description: 'تشغيل محرك الاحتساب المالي وتجميع البصمة والتأخيرات وتوزيع سلم الرواتب والعهد وتأمين الأجور',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.runs.submit',
    module: 'payroll',
    resource: 'runs',
    action: 'submit',
    arabicLabel: 'تقديم المسير الأولي للمراجعة والتدقيق الإداري لقفل التعديلات اليدوية',
    englishLabel: 'Submit Payroll Draft for Auditing',
    description: 'منع مدخلات تعديل البدلات وتوجيه المسيرة للقسم التدقيقي للفحص النهائي وإصدار الرواتب',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.runs.approve',
    module: 'payroll',
    resource: 'runs',
    action: 'approve',
    arabicLabel: 'الاعتماد النهائي وتوجيه ملفات السداد للمصارف الكبرى',
    englishLabel: 'Approve & Finalize Financial Payroll Runs',
    description: 'الموافقة وحقن وتوليد ملف السداد والاعتماد المحاسبي للأجور الشهرية',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.runs.lock',
    module: 'payroll',
    resource: 'runs',
    action: 'lock',
    arabicLabel: 'تأمين وحظر تعديل مسيرة الأرشفة كليًا',
    englishLabel: 'Lock/Freeze Historical Payroll Runs',
    description: 'تأمين وحفظ مسيرة الأجور كلياً لمنع مخرجات تعديلات تاريخية لدواعي الرقابة المالي والتدقيق',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.runs.calculate',
    module: 'payroll',
    resource: 'runs',
    action: 'create',
    arabicLabel: 'احتساب مسير رواتب من الواجهة الخلفية',
    englishLabel: 'Calculate Payroll',
    description: 'تشغيل محرك الاحتساب المالي وتنزيل البيانات من السيرفر',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.runs.review',
    module: 'payroll',
    resource: 'runs',
    action: 'edit',
    arabicLabel: 'مراجعة وتدقيق مسودة مسير الرواتب',
    englishLabel: 'Review Payroll Run',
    description: 'مراجعة تفصيلية وتحقق مالي قبل الاعتماد المالي الكلي',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.runs.export',
    module: 'payroll',
    resource: 'runs',
    action: 'export',
    arabicLabel: 'تصدير ملفات كشوفات الرواتب وسداد البنك',
    englishLabel: 'Export Payroll Files',
    description: 'تنزيل ملفات وورد وإكسل والملفات البنكية',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.runs.delete',
    module: 'payroll',
    resource: 'runs',
    action: 'delete',
    arabicLabel: 'حذف مسيرة الرواتب لم تكتمل',
    englishLabel: 'Delete Payroll Run',
    description: 'حذف مسيرة رواتب غير معتمدة أو لم تغلق لإعادة حسابها',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.mission_allowance_runs.view',
    module: 'payroll',
    resource: 'mission_allowance_runs',
    action: 'view',
    arabicLabel: 'عرض مسيرات بدلات المأموريات',
    englishLabel: 'View Mission Allowance Runs',
    description: 'مشاهدة قائمة وتفاصيل مسيرات صرف بدلات المأموريات',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.mission_allowance_runs.create',
    module: 'payroll',
    resource: 'mission_allowance_runs',
    action: 'create',
    arabicLabel: 'إنشاء مسير بدلات مأموريات جديد',
    englishLabel: 'Create Mission Allowance Run',
    description: 'توليد مسير جديد لفترة محددة وسحب وتوليد الأسطر الخاصة بالمأموريات المعتمدة',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.mission_allowance_runs.edit',
    module: 'payroll',
    resource: 'mission_allowance_runs',
    action: 'edit',
    arabicLabel: 'تعديل مسير بدلات المأموريات',
    englishLabel: 'Edit Mission Allowance Run',
    description: 'تعديل بيانات أو تفاصيل مسيرات بدلات المأموريات',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.mission_allowance_runs.delete',
    module: 'payroll',
    resource: 'mission_allowance_runs',
    action: 'delete',
    arabicLabel: 'حذف مسير بدلات المأموريات',
    englishLabel: 'Delete Mission Allowance Run',
    description: 'إزالة مسير مأموريات مسود بالكامل وإرجاع مأمورياته للفرز',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.mission_allowance_runs.submit',
    module: 'payroll',
    resource: 'mission_allowance_runs',
    action: 'submit',
    arabicLabel: 'تقديم مسير بدلات المأموريات',
    englishLabel: 'Submit Mission Allowance Run',
    description: 'قفل التعديلات وتقديم مسير المأموريات للمراجعة المالية والتدقيق',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.mission_allowance_runs.review',
    module: 'payroll',
    resource: 'mission_allowance_runs',
    action: 'review',
    arabicLabel: 'مراجعة وتدقيق مسير مأموريات',
    englishLabel: 'Review Mission Allowance Run',
    description: 'فحص الحسبات وأهلية الصرف المالي لسطور المأموريات',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.mission_allowance_runs.approve',
    module: 'payroll',
    resource: 'mission_allowance_runs',
    action: 'approve',
    arabicLabel: 'اعتماد مسير بدلات المأموريات نهائياً',
    englishLabel: 'Approve Mission Allowance Run',
    description: 'اعتماد نهائي وتوجيه أوامر الصرف المالي لبدلات المأموريات',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.mission_allowance_runs.lock',
    module: 'payroll',
    resource: 'mission_allowance_runs',
    action: 'lock',
    arabicLabel: 'إغلاق وقفل مسير بدلات المأموريات ماليًا',
    englishLabel: 'Lock Mission Allowance Run',
    description: 'منع كلي لإعادة الاحتساب أو فك الصرف وترهينه للمحاسبة والأقسام',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.mission_allowance_runs.export',
    module: 'payroll',
    resource: 'mission_allowance_runs',
    action: 'export',
    arabicLabel: 'تصدير كشوف وملفات صرف بدلات المأموريات',
    englishLabel: 'Export Mission Runs Data',
    description: 'تصدير إكسل أو ملف بنكي لصرف بدلات المأموريات المعتمدة',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.settlements.manage',
    module: 'payroll',
    resource: 'settlements',
    action: 'manage',
    arabicLabel: 'إدارة وتصفية المستحقات والتسويات والعهد المالية للموظفين',
    englishLabel: 'Manage Settlements & Liquidation Accounts',
    description: 'حسم العهد والمستحقات والفرق المالي عند غلق وتصفية بروفايل الموظف بنهاية خدمته',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.allowance_types.view',
    module: 'payroll',
    resource: 'allowance_types',
    action: 'view',
    arabicLabel: 'الاطلاع على أنواع البدلات المالية وهندستها الأجور والتعويضات',
    englishLabel: 'View Active Allowance Types Structure',
    description: 'مشاهدة خصائص بنود الراتب كأجور السكن، الانتقال، العلاج والمخاطر المهنية بالنظام ERP',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'payroll.allowance_types.manage',
    module: 'payroll',
    resource: 'allowance_types',
    action: 'manage',
    arabicLabel: 'إدارة وإعدادات أنواع العلاوات والتعويضات بالنظام',
    englishLabel: 'Manage Allowance Categories & Rules',
    description: 'تعديل وصياغة خصائص استحقاق البدلات ومعدلات الضرائب المستقطعة والنسب المؤتمتة بالتجميع',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },

  // Operations module
  {
    key: 'operations.dashboard.view',
    module: 'operations',
    resource: 'dashboard',
    action: 'view',
    arabicLabel: 'رؤية لوحة المتابعة الهندسية والعمليات والمخططات والإنتاج',
    englishLabel: 'View Operations Dashboard',
    description: 'الاطلاع على كفاءة المطورين، سرعة إنهاء المهام ومعدلات تأخر السكوب للمشاريع الهندسية',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.projects.view',
    module: 'operations',
    resource: 'projects',
    action: 'view',
    arabicLabel: 'رؤية ومعاينة العقود والمشاريع الهندسية لمسؤوليتك',
    englishLabel: 'View Assigned Development Projects',
    description: 'مشاهدة السكوب، الفواتير، الفريق المعين والمهام الهندسية الحالية للمشاريع',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'assigned'
  },
  {
    key: 'operations.projects.view_all',
    module: 'operations',
    resource: 'projects',
    action: 'view_all',
    arabicLabel: 'استعراض كل مشروعات المؤسسة دون التقيد بالمسؤولية السياقية والمباشرة',
    englishLabel: 'View All Enterprise Engineering Projects',
    description: 'رؤية شاملة ومطلقة لكل ملف من عقود ومشروعات شركة السוфтوير لأغراض المدير التقني والمتابعة',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.projects.create',
    module: 'operations',
    resource: 'projects',
    action: 'create',
    arabicLabel: 'تأسيس مشروع هندسي وتعيين فاقم الإدارة بالنظام',
    englishLabel: 'Create New Construction/Software Project',
    description: 'تحديد العملاء، نطاق التسليم وميزانيات ساعات العمل للمشاريع الجديدة لمكتب العمليات',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.projects.edit',
    module: 'operations',
    resource: 'projects',
    action: 'edit',
    arabicLabel: 'تعديل أو قفل مسودة للمشروعات الفنية المعينة',
    englishLabel: 'Edit Engineering Projects Details & Scope',
    description: 'تغيير أطقم المدير المسؤول PMs وتعديل تواريخ التسليم وفروع السكوب المحددة للعملاء',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.projects.manage_phases',
    module: 'operations',
    resource: 'projects',
    action: 'edit',
    arabicLabel: 'إدارة وتعديل مراحل المشروعات الهندسية',
    englishLabel: 'Manage Project Phases & Lifecycles',
    description: 'إضافة، تعديل، أو حذف مراحل سير العمل للمشروع وإنشاء المهام التلقائية',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.projects.manage_scope',
    module: 'operations',
    resource: 'projects',
    action: 'edit',
    arabicLabel: 'إدارة وتعديل نطاق واسكوب المشروعات',
    englishLabel: 'Manage Project Scope & Deliverables',
    description: 'إضافة، تعديل، أو حذف شرائح ونطاق تسليمات المشروع والتحكم بها',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.projects.delete',
    module: 'operations',
    resource: 'projects',
    action: 'delete',
    arabicLabel: 'شطب وحذف سجل مشروع هندسي بالكامل وتوابعه بإنذار فني',
    englishLabel: 'Delete Projects Records & Dependencies',
    description: 'حسم إزالة المشروع وسجلات المحادثات، المهام والملفات لتصفية DB',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.tasks.view',
    module: 'operations',
    resource: 'tasks',
    action: 'view',
    arabicLabel: 'رؤية ومطالعة تفاصيل المهام في المشاريع الهندسية الخاصة بي',
    englishLabel: 'View Project Engineering Tasks',
    description: 'مشاهدة الأنشطة المسندة وحالات العمل لإعانتك في تتبع عمليات السوفتوير والتطوير',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'assigned'
  },
  {
    key: 'operations.tasks.view_all',
    module: 'operations',
    resource: 'tasks',
    action: 'view_all',
    arabicLabel: 'عرض واستعراض كافة المهام الكلية المعلقة دون تصفية سياقية',
    englishLabel: 'View All Tasks Across Project Contexts',
    description: 'لوحة موحدة لعرض كافة مهام الأفراد بالمنظمة بدون قيود السيكولوجيا السياقية والمنفذين',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.tasks.create',
    module: 'operations',
    resource: 'tasks',
    action: 'create',
    arabicLabel: 'إسناد تذكرة مهمة وتوزيع نطاقات العمل للمهندسين والمطورين',
    englishLabel: 'Create New Project Tasks',
    description: 'إنشاء تذكرة مبرمج، تعيين المنفذ وإقرار نطاق ساعات الانتهاء التقديرية بالـ Sprint',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.tasks.edit',
    module: 'operations',
    resource: 'tasks',
    action: 'edit',
    arabicLabel: 'تعديل وتحرير بيانات التذاكر والمهام وسويعاتها',
    englishLabel: 'Edit Tasks & Re-estimate Engineering Sprints',
    description: 'تحديث مخرجات المهمة، تدوير أوصاف التحليل وساعات العمل المعينة للشركة قبل قفلها',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.tasks.delete',
    module: 'operations',
    resource: 'tasks',
    action: 'delete',
    arabicLabel: 'حذف أو إسقاط مهمة بالإنباء مع مسح متعلقاتها للمشروعات',
    englishLabel: 'Delete Active Tasks From Projects',
    description: 'سقوط وإلغاء تذكرة المهمة مع ملفات والمرفقات المنشورة بضمان أمني لمنع تراكم التذاكر المنتهية',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.tasks.assign',
    module: 'operations',
    resource: 'tasks',
    action: 'assign',
    arabicLabel: 'تفويض وتغيير المنفذين ومبرمجين الأنشطة للمهمة',
    englishLabel: 'Assign Tasks to Engineering Staff',
    description: 'إعادة تدوير نطاق العمل وتوزيع المهام بين المطورين بالشركة لزيادة كفاء الإنتاج',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.tasks.change_status',
    module: 'operations',
    resource: 'tasks',
    action: 'change_status',
    arabicLabel: 'تغيير حالة المهام في دورة البرودكشن',
    englishLabel: 'Change Tasks Operational Status',
    description: 'تمكين المطور أو الفني من تغيير حالة تذكرة العمل من قيّد التحليل إلى التحقق البرمجي أو الإنهاء المعتمد',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'assigned'
  },
  {
    key: 'operations.tasks.approve',
    module: 'operations',
    resource: 'tasks',
    action: 'approve',
    arabicLabel: 'اعتماد ومراجعة مخرجات وجودة الكود للمهمة المنتهية',
    englishLabel: 'Approve Finished Sprints & Deliverables',
    description: 'منح الموافقة الهندسية والشركة لمنجزات المبرمج والتحقق من سلامة المخرجات التقنية',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'all'
  },
  {
    key: 'operations.tasks.close',
    module: 'operations',
    resource: 'tasks',
    action: 'close',
    arabicLabel: 'قفل وإغلاق مسار العمل لتذاكر المهام كلياً',
    englishLabel: 'Close Successfully Finished Engineering Tasks',
    description: 'قفل تذكرة المطور نهائياً للأرشفة وحمايتها من مخرجات التلاعبات أو التعديلات اللاحقة لانتهاء المشروع',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'all'
  },
  {
    key: 'operations.task_chat.view',
    module: 'operations',
    resource: 'task_chat',
    action: 'view',
    arabicLabel: 'قراءة والمشاركة بنقاشات محادثات تواصل المهام',
    englishLabel: 'View Tasks Collaborative Conversations',
    description: 'الانضمام والاطلاع والمساهمة بتحديثات المطورين في نقاش غرف المهام',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'assigned'
  },
  {
    key: 'operations.task_chat.view_all',
    module: 'operations',
    resource: 'task_chat',
    action: 'view_all',
    arabicLabel: 'الاطلاع العام ومراقبة كافة سياقات الاتصال لغرف المحادثات',
    englishLabel: 'Access All Task Management Discussion Rooms',
    description: 'أحقية المدير التقني والمراجع في تفتيش كافة نقاش المبرمجين وتوجيه مساعي جودة التواصل',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'operations.task_chat.send',
    module: 'operations',
    resource: 'task_chat',
    action: 'send',
    arabicLabel: 'إرسال ونشر تعليق أو صورة بغرفة محادثات التذاكر',
    englishLabel: 'Post Chats & Comments in Task Discussion Rooms',
    description: 'كتابة إشارات للمنفذين بالمهام وإمداد المطورين بنقاط التقدم البرمجي المتاحة',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'assigned'
  },
  {
    key: 'operations.task_chat.delete_own',
    module: 'operations',
    resource: 'task_chat',
    action: 'delete_own',
    arabicLabel: 'حذف الرسائل الصادرة الخاصة من شات التذكرة للمنتسب نفسه',
    englishLabel: 'Delete Sent Chat Messages',
    description: 'إخلاء وإزالة الأسطر الكودية أو المحادثة التوجيهية المكتوبة مسبقًا بواسطة الحساب ذاته',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'own'
  },
  {
    key: 'operations.task_chat.moderate',
    module: 'operations',
    resource: 'task_chat',
    action: 'moderate',
    arabicLabel: 'مراقبت وإدارة وتصفية رسائل شات التذاكر والمطورين',
    englishLabel: 'Moderate Project Chat Messages & Intercoms',
    description: 'حذف التعليقات الخاطئة والملفات المنشورة بشكل أمني لتأمين سرية الكود بكلام الفريق لجميع المستخدمين',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  },

  // Self Service module
  {
    key: 'self_service.dashboard.view',
    module: 'self_service',
    resource: 'dashboard',
    action: 'view',
    arabicLabel: 'رؤية لوحة المتابعة للخدمة الذاتية الخاصة بك',
    englishLabel: 'View Self Service Dashboard',
    description: 'استعراض بياناتي المالية، غياباتي، حضور يومي، تذاكر المهام المعينة لحسابي الشخصي',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'own'
  },
  {
    key: 'self_service.attendance.check_in',
    module: 'self_service',
    resource: 'attendance',
    action: 'check_in',
    arabicLabel: 'تسجيل وبصومة الحضور الذاتي بالبوابة',
    englishLabel: 'Perform Self Attendance Check-In',
    description: 'تسجيل وقت العمل اليومي وتأكيد الإحداث الجغرافي للجوال/الكمبيوتر لموقعي الحقيقي',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'own'
  },
  {
    key: 'self_service.attendance.check_out',
    module: 'self_service',
    resource: 'attendance',
    action: 'check_out',
    arabicLabel: 'تسجيل وبصومة الانصراف الذاتي بالبوابة',
    englishLabel: 'Perform Self Attendance Check-Out',
    description: 'تسجيل قفل ساعات العمل اليومي الشخصي لحفظ السجل اليومي للأجر ماليًا',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'own'
  },
  {
    key: 'self_service.leaves.create',
    module: 'self_service',
    resource: 'leaves',
    action: 'create',
    arabicLabel: 'تقديم استمارة طلب إجازة سنوي/مرضي جديد',
    englishLabel: 'Apply For Self Leave Requests',
    description: 'رفع تبريرات الغياب السنوي، الرخص الطبية وإرسالها لمدير HR للمصادقة عليها',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'own'
  },
  {
    key: 'self_service.missions.create',
    module: 'self_service',
    resource: 'missions',
    action: 'create',
    arabicLabel: 'تقديم طلب تكليف مأمورية عمل أو زيارة ميدانية جديدة',
    englishLabel: 'Submit Self Mission Cost Authorization',
    description: 'طلب مصروفات سفر ومهمات زيارة للموقع هندسيًا لتأمين مهندسي التنفيذ للشركة',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'own'
  },
  {
    key: 'self_service.my_tasks.view',
    module: 'self_service',
    resource: 'my_tasks',
    action: 'view',
    arabicLabel: 'عرض المهام والأنشطة الشخصية المخصصة لي بالمنظمة',
    englishLabel: 'Access Self Task Board & Workflow',
    description: 'الولوج المباشر لقسم تذاكر السوفتوير والمهام الشخصية التي ترتبط باسمك مع إشارات المطورين',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'own'
  },
  {
    key: 'self_service.my_tasks.create',
    module: 'self_service',
    resource: 'my_tasks',
    action: 'create',
    arabicLabel: 'إضافة مهمة شخصية',
    englishLabel: 'Create Personal Task',
    description: 'صلاحية تتيح للمستخدم إضافة وإنشاء مهام شخصية جديدة في شاشة مهامي الشخصية',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'own'
  },
  {
    key: 'self_service.profile.edit',
    module: 'self_service',
    resource: 'profile',
    action: 'edit',
    arabicLabel: 'تعديل البروفايل الذاتي ورفع الأوراق الحكومية المقترنة بالحساب',
    englishLabel: 'Update Self Employee Profile Details',
    description: 'تغيير صور الإقامة، الحساب المصرفي الشخصي أو بيانات الاتصال للموارد البشرية مباشرة',
    isDangerous: false,
    requiresEmployeeMapping: true,
    scope: 'own'
  },
  {
    key: 'time_management.eisenhower_all',
    module: 'self_service',
    resource: 'my_tasks',
    action: 'view_all',
    arabicLabel: 'رؤية مصفوفة إيزنهاور ومهام جميع موظفي الشركة (للمدير التنفيذي)',
    englishLabel: 'View Eisenhower Matrix for All Employees (Executive)',
    description: 'صلاحية استعراض مصفوفة أيزنهاور والمهام الموزعة لكافة الموظفين بالمنظمة من لوحة التحكم',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'self_service.executive_team_dashboard_access',
    module: 'self_service',
    resource: 'my_team',
    action: 'view_all',
    arabicLabel: 'صلاحية شاشة فريقي لكافة موظفي الشركة (Executive Team Dashboard Access)',
    englishLabel: 'Executive Team Dashboard Access',
    description: 'صلاحية خاصة تتيح للمستخدم عرض ومتابعة جميع موظفي الشركة من خلال شاشة فريقي دون التقيد بالهيكل الإداري المباشر',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },

  // Files module
  {
    key: 'files.upload',
    module: 'files',
    resource: 'archiving',
    action: 'upload',
    arabicLabel: 'رفع الفواتير، الملفات، والصور للأرشيف بالأرصدة',
    englishLabel: 'Upload Attachments & Invoices to Library',
    description: 'صلاحية حقن ملفات السيرفر بإنشاء مستند فني للمهام، الإجازات والمأموريات',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'files.download',
    module: 'files',
    resource: 'archiving',
    action: 'download',
    arabicLabel: 'تحميل وقراءة الوثائق الورقية والآيس والعهد بالأرشيف',
    englishLabel: 'Download Archive Files & Official Paperwork',
    description: 'فحص الأوراق المرفوعة وتنزيل المستند للتدقيق فيه والعمل بمحاضر الزيارة والطلبات',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'all'
  },
  {
    key: 'files.delete_own',
    module: 'files',
    resource: 'archiving',
    action: 'delete_own',
    arabicLabel: 'إسقاط وحذف الملفات المرفوعة بواسطتك بالنظام',
    englishLabel: 'Delete Owned Uploaded Files',
    description: 'مسح الأوراق الخاطئة المسجلة بنطاق حسابك تلافيا لتكرار المدخلات والوثائق المتراكمة بالأرشيف',
    isDangerous: false,
    requiresEmployeeMapping: false,
    scope: 'own'
  },
  {
    key: 'files.delete_any',
    module: 'files',
    resource: 'archiving',
    action: 'delete_any',
    arabicLabel: 'حسم وحذف أي مستند أو وثيقة مخزنة بالخادم بلا استثناء بموافقة أمني',
    englishLabel: 'Delete Any File Across Enterprise Storage Pools',
    description: 'حذف وثيقة هندسية أو عقد رسمي مخزن بالسيرفر بإنذار أمني خطير لأغراض تصفية قواعد الأرشفة',
    isDangerous: true,
    requiresEmployeeMapping: false,
    scope: 'all'
  }
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  'Super Admin': ['*'],
  'Admin': ['*'],
  'Executive Director': ['*'],
  'General Manager': ['*'],
  'CEO': ['*'],
  'System Admin': [
    'admin.users.view', 'admin.users.create', 'admin.users.edit', 'admin.users.delete',
    'admin.permissions.manage', 'admin.organization_settings.manage', 'admin.wifi_settings.manage',
    'admin.system_logs.view', 'admin.security_settings.manage', 'admin.notices.manage', 'admin.notices.view',
    'time_management.eisenhower_all',
    'files.upload', 'files.download', 'files.delete_own', 'files.delete_any'
  ],
  'Operations Director': [
    'operations.dashboard.view',
    'operations.projects.view', 'operations.projects.view_all', 'operations.projects.create', 'operations.projects.edit', 'operations.projects.manage_phases', 'operations.projects.manage_scope', 'operations.projects.delete',
    'operations.tasks.view', 'operations.tasks.view_all', 'operations.tasks.create', 'operations.tasks.edit', 'operations.tasks.delete',
    'operations.task_chat.view', 'operations.task_chat.view_all', 'operations.task_chat.send', 'operations.task_chat.delete_own', 'operations.task_chat.moderate',
    'time_management.eisenhower_all',
    'files.upload', 'files.download', 'files.delete_own', 'files.delete_any',
    'self_service.dashboard.view', 'self_service.my_tasks.view', 'self_service.my_tasks.create'
  ],
  'Project Manager': [
    'operations.dashboard.view',
    'operations.projects.view', 'operations.projects.edit', 'operations.projects.manage_phases', 'operations.projects.manage_scope',
    'operations.tasks.view', 'operations.tasks.create', 'operations.tasks.edit', 'operations.tasks.assign', 'operations.tasks.change_status', 'operations.tasks.approve', 'operations.tasks.close',
    'operations.task_chat.view', 'operations.task_chat.send', 'operations.task_chat.delete_own',
    'hr.penalties.approve', 'hr.penalties.view',
    'self_service.my_tasks.view', 'self_service.my_tasks.create', 'self_service.dashboard.view',
    'files.upload', 'files.download', 'files.delete_own'
  ],
  'Team Leader': [
    'operations.dashboard.view',
    'operations.projects.view', 'operations.projects.manage_phases', 'operations.projects.manage_scope',
    'operations.tasks.view', 'operations.tasks.create', 'operations.tasks.edit', 'operations.tasks.assign', 'operations.tasks.change_status', 'operations.tasks.approve',
    'operations.task_chat.view', 'operations.task_chat.send', 'operations.task_chat.delete_own',
    'hr.penalties.approve', 'hr.penalties.view',
    'self_service.my_tasks.view', 'self_service.my_tasks.create', 'self_service.dashboard.view',
    'files.upload', 'files.download', 'files.delete_own'
  ],
  'Operations User': [
    'operations.dashboard.view',
    'operations.tasks.view', 'operations.tasks.create', 'operations.tasks.edit', 'operations.tasks.change_status',
    'operations.task_chat.view', 'operations.task_chat.send',
    'self_service.my_tasks.view', 'self_service.my_tasks.create', 'self_service.dashboard.view',
    'files.upload', 'files.download'
  ],
  'HR Manager': [
    'hr.dashboard.view', 'hr.employees.view', 'hr.employees.create', 'hr.employees.edit', 'hr.employees.delete',
    'hr.attendance.view', 'hr.attendance.create', 'hr.attendance.edit',
    'hr.missions.view', 'hr.missions.edit', 'mission.edit', 'hr.missions.approve', 'hr.missions.delete',
    'hr.leaves.view', 'hr.leaves.approve', 'hr.leaves.delete',
    'hr.penalties.view', 'hr.penalties.create', 'hr.penalties.edit', 'hr.penalties.approve', 'hr.penalties.delete', 'hr.penalties.grievance',
    'hr.investigations.view', 'hr.investigations.manage',
    'hr.admin_structure.view', 'hr.admin_structure.manage',
    'hr.performance.manage', 'admin.notices.manage', 'admin.notices.view',
    'operations.tasks.create', 'operations.tasks.edit', 'operations.tasks.assign',
    'self_service.dashboard.view', 'self_service.attendance.check_in', 'self_service.attendance.check_out', 'self_service.leaves.create', 'self_service.missions.create', 'self_service.my_tasks.view', 'self_service.my_tasks.create', 'self_service.profile.edit',
    'files.upload', 'files.download', 'files.delete_own', 'files.delete_any'
  ],
  'HR Officer': [
    'hr.dashboard.view', 'hr.employees.view', 'hr.employees.create', 'hr.employees.edit',
    'hr.attendance.view', 'hr.attendance.create',
    'hr.missions.view',
    'hr.leaves.view',
    'hr.penalties.view', 'hr.penalties.create', 'hr.penalties.edit',
    'hr.investigations.view',
    'hr.performance.view',
    'self_service.dashboard.view', 'self_service.attendance.check_in', 'self_service.attendance.check_out', 'self_service.leaves.create', 'self_service.missions.create', 'self_service.my_tasks.view', 'self_service.my_tasks.create', 'self_service.profile.edit',
    'files.upload', 'files.download'
  ],
  'Payroll Manager': [
    'payroll.dashboard.view', 'payroll.transactions.view', 'payroll.transactions.create', 'payroll.transactions.edit', 'payroll.transactions.delete',
    'payroll.runs.view', 'payroll.runs.create', 'payroll.runs.calculate', 'payroll.runs.submit', 'payroll.runs.review', 'payroll.runs.approve', 'payroll.runs.lock', 'payroll.runs.export', 'payroll.runs.delete',
    'payroll.mission_allowance_runs.view', 'payroll.mission_allowance_runs.create', 'payroll.mission_allowance_runs.edit', 'payroll.mission_allowance_runs.delete', 'payroll.mission_allowance_runs.submit', 'payroll.mission_allowance_runs.review', 'payroll.mission_allowance_runs.approve', 'payroll.mission_allowance_runs.lock', 'payroll.mission_allowance_runs.export',
    'payroll.settlements.manage', 'payroll.allowance_types.view', 'payroll.allowance_types.manage',
    'self_service.dashboard.view', 'self_service.attendance.check_in', 'self_service.attendance.check_out', 'self_service.leaves.create', 'self_service.missions.create', 'self_service.my_tasks.view', 'self_service.my_tasks.create', 'self_service.profile.edit',
    'files.upload', 'files.download', 'files.delete_own', 'files.delete_any'
  ],
  'Payroll Officer': [
    'payroll.dashboard.view', 'payroll.transactions.view', 'payroll.transactions.create', 'payroll.transactions.edit',
    'payroll.runs.view', 'payroll.runs.create', 'payroll.runs.calculate', 'payroll.runs.submit', 'payroll.runs.review',
    'payroll.mission_allowance_runs.view', 'payroll.mission_allowance_runs.create', 'payroll.mission_allowance_runs.edit', 'payroll.mission_allowance_runs.submit', 'payroll.mission_allowance_runs.review',
    'self_service.dashboard.view', 'self_service.attendance.check_in', 'self_service.attendance.check_out', 'self_service.leaves.create', 'self_service.missions.create', 'self_service.my_tasks.view', 'self_service.my_tasks.create', 'self_service.profile.edit',
    'files.upload', 'files.download'
  ],
  'Attendance Officer': [
    'hr.dashboard.view', 'hr.attendance.view', 'hr.attendance.create', 'hr.attendance.edit',
    'admin.wifi_settings.manage',
    'self_service.dashboard.view', 'self_service.attendance.check_in', 'self_service.attendance.check_out', 'self_service.leaves.create', 'self_service.missions.create', 'self_service.my_tasks.view', 'self_service.my_tasks.create', 'self_service.profile.edit',
    'files.upload', 'files.download'
  ],
  'Auditor': [
    'operations.dashboard.view', 'operations.projects.view', 'operations.tasks.view', 'operations.task_chat.view',
    'hr.dashboard.view', 'hr.employees.view', 'hr.attendance.view', 'hr.missions.view', 'hr.leaves.view',
    'payroll.dashboard.view', 'payroll.transactions.view', 'payroll.runs.view', 'payroll.mission_allowance_runs.view',
    'admin.system_logs.view',
    'files.download'
  ],
  'Employee': [
    'self_service.dashboard.view',
    'self_service.attendance.check_in',
    'self_service.attendance.check_out',
    'self_service.leaves.create',
    'self_service.missions.create',
    'self_service.my_tasks.view',
    'self_service.my_tasks.create',
    'self_service.profile.edit',
    'operations.tasks.change_status',
    'files.upload', 'files.download'
  ],
  'Viewer': [
    'self_service.dashboard.view',
    'self_service.my_tasks.view',
    'operations.tasks.change_status',
    'files.download'
  ]
};

export const expandPermissions = (perms: string[]): string[] => {
  if (perms.includes('*') || perms.includes('all')) return ['*'];
  const expanded = new Set<string>();

  for (const p of perms) {
    if (p === '*') {
      expanded.add('*');
      continue;
    }

    expanded.add(p);

    // Expand wildcard modules
    if (p === 'hr.*' || p === 'hr') {
      SYSTEM_PERMISSIONS.filter(sp => sp.module === 'hr').forEach(sp => expanded.add(sp.key));
    } else if (p === 'payroll.*' || p === 'payroll') {
      SYSTEM_PERMISSIONS.filter(sp => sp.module === 'payroll').forEach(sp => expanded.add(sp.key));
    } else if (p === 'admin.*' || p === 'admin') {
      SYSTEM_PERMISSIONS.filter(sp => sp.module === 'admin').forEach(sp => expanded.add(sp.key));
    } else if (p === 'operations.*' || p === 'operations') {
      SYSTEM_PERMISSIONS.filter(sp => sp.module === 'operations').forEach(sp => expanded.add(sp.key));
    } else if (p === 'self_service.*' || p === 'self_service') {
      SYSTEM_PERMISSIONS.filter(sp => sp.module === 'self_service').forEach(sp => expanded.add(sp.key));
    } else if (p === 'files.*' || p === 'files') {
      SYSTEM_PERMISSIONS.filter(sp => sp.module === 'files').forEach(sp => expanded.add(sp.key));
    }

    // Specific logic mapping
    // If a permission ends with .manage, grant its sibling actions: view, create, edit, delete
    if (p.endsWith('.manage')) {
      const base = p.slice(0, -7); // e.g., 'hr.admin_structure'
      expanded.add(`${base}.view`);
      expanded.add(`${base}.create`);
      expanded.add(`${base}.edit`);
      expanded.add(`${base}.delete`);
    }

    // If permission has edit, create, or delete, it implies they should also be able to view that resource
    if (p.endsWith('.edit') || p.endsWith('.create') || p.endsWith('.delete') || p.endsWith('.approve') || p.endsWith('.assign') || p.endsWith('.lock') || p.endsWith('.submit') || p.endsWith('.change_status') || p.endsWith('.send')) {
      const lastDot = p.lastIndexOf('.');
      if (lastDot !== -1) {
        const base = p.slice(0, lastDot);
        expanded.add(`${base}.view`);
      }
    }
    
    // Explicit bridge rules for attendance check_in_out compatibility
    if (p === 'hr.attendance.check_in_out') {
      expanded.add('hr.attendance.create');
      expanded.add('hr.attendance.edit');
      expanded.add('hr.attendance.view');
    }
  }

  return Array.from(expanded);
};
