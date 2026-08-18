CREATE TABLE `deduction_master_transaction_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`deduction_type_id` text NOT NULL,
	`calculated_value` real DEFAULT 0,
	`company_value` real DEFAULT 0,
	`notes` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `deduction_master_transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deduction_type_id`) REFERENCES `deduction_master_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `deduction_master_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`form_number` text NOT NULL,
	`month` text NOT NULL,
	`year` text NOT NULL,
	`company` text,
	`department_id` text,
	`status` text DEFAULT 'Draft',
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `deduction_master_types` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'Active',
	`start_date` text,
	`end_date` text,
	`calculation_method` text NOT NULL,
	`fixed_amount` real DEFAULT 0,
	`percentage` real DEFAULT 0,
	`brackets` text,
	`equation` text,
	`charge_type` text NOT NULL,
	`employee_percentage` real DEFAULT 0,
	`company_percentage` real DEFAULT 0,
	`employee_amount` real DEFAULT 0,
	`company_amount` real DEFAULT 0,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `end_of_service_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`termination_date` text NOT NULL,
	`last_working_day` text NOT NULL,
	`reason` text NOT NULL,
	`last_salary_due` real DEFAULT 0,
	`leave_balance_amount` real DEFAULT 0,
	`end_of_service_benefit` real DEFAULT 0,
	`loans` real DEFAULT 0,
	`advances` real DEFAULT 0,
	`deductions` real DEFAULT 0,
	`custody_deductions` real DEFAULT 0,
	`insurance_deductions` real DEFAULT 0,
	`net_settlement` real DEFAULT 0,
	`status` text DEFAULT 'Draft' NOT NULL,
	`hr_notes` text,
	`finance_notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `penalties` (
	`id` text PRIMARY KEY NOT NULL,
	`penalty_number` text NOT NULL,
	`employee_id` text NOT NULL,
	`department_id` text,
	`violation_date` text NOT NULL,
	`penalty_date` text NOT NULL,
	`violation_type` text NOT NULL,
	`description` text NOT NULL,
	`attachment_url` text,
	`penalty_type` text NOT NULL,
	`deduction_type` text,
	`deduction_value` real DEFAULT 0,
	`target_month` text,
	`fiscal_year` text,
	`submitter_id` text,
	`approver_id` text,
	`status` text DEFAULT 'Draft',
	`admin_notes` text,
	`employee_notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_number` text NOT NULL,
	`month` text NOT NULL,
	`period_from` text,
	`period_to` text,
	`payroll_group` text,
	`legal_entity` text,
	`status` text DEFAULT 'Draft',
	`total_gross` real DEFAULT 0,
	`total_deductions` real DEFAULT 0,
	`total_net` real DEFAULT 0,
	`employee_count` integer DEFAULT 0,
	`created_by` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`submitted_by` text,
	`submitted_at` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`approved_by` text,
	`approved_at` text,
	`locked_by` text,
	`locked_at` text,
	`notes` text,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
INSERT INTO `__new_payroll_runs`("id", "run_number", "month", "period_from", "period_to", "payroll_group", "legal_entity", "status", "total_gross", "total_deductions", "total_net", "employee_count", "created_by", "created_at", "submitted_by", "submitted_at", "reviewed_by", "reviewed_at", "approved_by", "approved_at", "locked_by", "locked_at", "notes", "updated_at") SELECT "id", '' AS "run_number", "month", NULL AS "period_from", NULL AS "period_to", NULL AS "payroll_group", NULL AS "legal_entity", "status", 0 AS "total_gross", 0 AS "total_deductions", "total_net", "employee_count", NULL AS "created_by", 'CURRENT_TIMESTAMP' AS "created_at", NULL AS "submitted_by", NULL AS "submitted_at", NULL AS "reviewed_by", NULL AS "reviewed_at", NULL AS "approved_by", NULL AS "approved_at", NULL AS "locked_by", NULL AS "locked_at", NULL AS "notes", "updated_at" FROM `payroll_runs`;--> statement-breakpoint
DROP TABLE `payroll_runs`;--> statement-breakpoint
ALTER TABLE `__new_payroll_runs` RENAME TO `payroll_runs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `employees` ADD `legal_entity` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `payroll_group` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `contract_type` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `end_of_service_date` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `insurance_profile` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `tax_profile` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `leave_plan` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `grade_level` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `subject_to_si` text DEFAULT 'No';--> statement-breakpoint
ALTER TABLE `employees` ADD `si_number` text;--> statement-breakpoint
ALTER TABLE `employees` ADD `subject_to_tax` text DEFAULT 'No';--> statement-breakpoint
ALTER TABLE `employees` ADD `tax_exempt` text DEFAULT 'No';--> statement-breakpoint
ALTER TABLE `employees` ADD `active_deductions` text;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD `actual_return_date` text;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD `return_request_status` text;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD `return_request_notes` text;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD `return_request_approved_at` text;--> statement-breakpoint
ALTER TABLE `payroll_results` ADD `other_income` real;--> statement-breakpoint
ALTER TABLE `payroll_results` ADD `other_deductions` real;--> statement-breakpoint
ALTER TABLE `payroll_results` ADD `absence_days` real;--> statement-breakpoint
ALTER TABLE `payroll_results` ADD `unpaid_leave_days` real;--> statement-breakpoint
ALTER TABLE `payroll_results` ADD `unpaid_leave_deduction` real;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `overtime_rate` real DEFAULT 1.5;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `delay_hourly_rate` real DEFAULT 1;--> statement-breakpoint
ALTER TABLE `transactions` ADD `unpaid_leave_days` real;--> statement-breakpoint
ALTER TABLE `transactions` ADD `unpaid_leave_deduction` real;--> statement-breakpoint
ALTER TABLE `transactions` ADD `other_income_reason` text;