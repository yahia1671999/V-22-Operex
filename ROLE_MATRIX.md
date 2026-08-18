# system Role Permission & Context Matrix

This document lists the 13 default roles available in the Enterprise Permission Engine and their corresponding permission strings and contextual rules.

| # | Role (العربية) | Contextual Role | Core Permissions Preset | Scoping Rule (قاعدة استعلامات الخادم) |
|---|:---|:---|:---|:---|
| 1 | **سوبر أدمن** | Super Admin | `['*']` | **كامل الصلاحيات**: لا يوجد أي فلترة؛ رؤية كل الجداول والمشاريع والمالية وتجاوز كافة قيود الأمان. |
| 2 | **مدير النظام** | System Admin | `['admin.*', 'files.*']` | **إدارة إعدادات الأمان وقنوات الواي فاي**: رؤية سجل العمليات الأمنية وكتل المستخدمين وتعديلها. |
| 3 | **مدير التشغيل** | Operations Director | `['operations.*', 'self_service.*', 'files.*']` | **إشراف شامل على التشغيل**: رؤية كافة المشاريع والمهام والدردشات بالشركة دون استثناء. |
| 4 | **مدير مشروع** | Project Manager | `['operations.projects.*', 'operations.tasks.*', 'operations.task_chat.*', 'self_service.*']` | **فلترة المشاريع المسندة فقط**: يرى المشاريع التي تم تعيينه مديراً لها، ومهام تلك المشاريع. |
| 5 | **قائد فريق** | Team Leader | `['operations.tasks.*', 'operations.task_chat.view_all', 'self_service.*']` | **فلترة المشاريع المشارك فيها**: يرى مشاريع فريقه، المهام المسندة لمجموعته، ودردشة تلك المهام. |
| 6 | **مهندس تشغيل** | Operations User | `['operations.my_tasks.*', 'self_service.*', 'files.download']` | **سياق المهام الشخصية**: يرى المهام فقط التي تخصه مباشرةً أو تمت الإشارة إليه بـ `@mention` فيها. |
| 7 | **مدير الموارد البشرية** | HR Manager | `['hr.*', 'self_service.*', 'files.*']` | **إدارة شؤون المنشأة**: رؤية وتعديل سجلات كل الموظفين، الحضور التراكمي، غياباتهم، واعتماداتهم. |
| 8 | **مسؤول الموارد البشرية**| HR Officer | `['hr.employees.view', 'hr.employees.create', 'hr.employees.edit', 'hr.attendance.view', 'hr.missions.view', 'hr.leaves.view', 'self_service.*']` | **تنفيذ عمليات التقديم**: إدخال الموظفين ومتابعة حضورهم، ولكن لا يملك صلاحية مسح أو تعديل الهيكل الرئيسي. |
| 9 | **مدير الرواتب والمالية**| Payroll Manager | `['payroll.*', 'self_service.*']` | **الاحتساب والاعتماد المالي**: إدارة وتطبيق مسيرات الرواتب على كامل منسوبي المنشأة وإصدار مسيرات. |
| 10| **مسؤول الرواتب** | Payroll Officer | `['payroll.transactions.view', 'payroll.transactions.create', 'payroll.transactions.edit', 'payroll.runs.view', 'self_service.*']` | **تسجيل الحركات والبدلات المباشرة**: إدخال بدلات وتعديلات المعالجة ولكن لا يملك صلاحية اعتماد الصرف للمصرف. |
| 11| **مسؤول الحضور** | Attendance Officer | `['hr.attendance.*', 'self_service.*']` | **تتبع الدخول والخروج اليومي**: تهيئة وبصم شبكات الواي فاي الذكية وأجهزة وبصوم ورديات الموظفين. |
| 12| **المراجع والمراقب المالي**| Auditor | `['*.view', 'self_service.*']` | **قراءة فقط (Read-Only) كامل**: يستعرض الرواتب، الحركات، وسجلات الموظفين والتطوير للمراقبة والأمان دون أي تعديل. |
| 13| **الموظف العادي** | Employee | `['self_service.*', 'files.download']` | **محدود بالخدمة الذاتية الخاصة به**: يقتصر استعلامه فقط على حضور/غيابات/استحقاقات/مهمات ملفه الشخصي فقط. |

---

## دمج الصلاحيات (Effective Permissions Evaluation)
عند تقييم الصلاحيات، يتم دمج هذه الأدوار تلقائياً بديناميكية تامة مع أي صلاحيات مباشرة مخصصة تم إدخالها لحساب المستخدم من شاشة **إعدادات الحسابات والأمان**. الموظف يحصل على:
$$\text{Effective Permissions} = \text{Default Role Presets} \cup \text{Direct User Specifications}$$
وهي مطبقة بأمان كامل على كل مسارات واجهة الخلفية (Backend endpoints) والواجهة الأمامية (Client UI Screens).
