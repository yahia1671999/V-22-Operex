CREATE TABLE `absence_records` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`date` text NOT NULL,
	`absence_type_id` text,
	`note` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`absence_type_id`) REFERENCES `absence_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `absence_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`deduction_ratio` real DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `admin_departments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`manager_id` text,
	`parent_dept_id` text
);
--> statement-breakpoint
CREATE TABLE `allowance_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`password` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`permissions` text,
	`photo_url` text,
	`lock_password` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_email_unique` ON `app_users` (`email`);--> statement-breakpoint
CREATE TABLE `attendance_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ip_address` text,
	`port` integer,
	`last_sync` text,
	`status` text DEFAULT 'Offline'
);
--> statement-breakpoint
CREATE TABLE `attendance_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`attendance_date` text NOT NULL,
	`action_type` text NOT NULL,
	`action_time` text NOT NULL,
	`status` text NOT NULL,
	`failure_reason` text,
	`matched_network_id` text,
	`public_ip` text,
	`local_ip` text,
	`ssid` text,
	`gateway_ip` text,
	`device_id` text,
	`browser_info` text,
	`latitude` real,
	`longitude` real,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`matched_network_id`) REFERENCES `wifi_attendance_networks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`timestamp` text NOT NULL,
	`type` text NOT NULL,
	`device_id` text,
	`device_name` text,
	`manual` integer DEFAULT false,
	`note` text,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `attendance_shifts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`grace_minutes` integer DEFAULT 0,
	`work_days` text
);
--> statement-breakpoint
CREATE TABLE `dashboard_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`notification_type` text,
	`title` text NOT NULL,
	`message` text,
	`is_read` integer DEFAULT false,
	`related_entity_type` text,
	`related_entity_id` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`name` text NOT NULL,
	`iqama_number` text,
	`nationality` text,
	`job_title` text,
	`join_date` text,
	`work_type` text,
	`bank_account` text,
	`bank_code` text,
	`payment_method` text,
	`basic_salary` real DEFAULT 0,
	`housing_allowance` real DEFAULT 0,
	`transport_allowance` real DEFAULT 0,
	`subsistence_allowance` real DEFAULT 0,
	`other_allowances` real DEFAULT 0,
	`mobile_allowance` real DEFAULT 0,
	`management_allowance` real DEFAULT 0,
	`daily_work_hours` integer DEFAULT 8,
	`status` text DEFAULT 'Active',
	`allowances` text,
	`role` text,
	`email` text,
	`shift_id` text,
	`manager_id` text,
	`department_id` text,
	`branch_id` text,
	FOREIGN KEY (`shift_id`) REFERENCES `attendance_shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`department_id`) REFERENCES `admin_departments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_employee_id_unique` ON `employees` (`employee_id`);--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`manager_id` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`days_count` integer,
	`type` text NOT NULL,
	`reason` text,
	`attachment_url` text,
	`status` text DEFAULT 'Pending',
	`workflow_status` text,
	`review_note` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mission_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`manager_id` text,
	`mission_type` text,
	`mission_date` text NOT NULL,
	`from_time` text,
	`to_time` text,
	`destination` text,
	`purpose` text,
	`transportation_required` integer,
	`expected_cost` real,
	`attachment_url` text,
	`status` text DEFAULT 'Pending',
	`workflow_status` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mission_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`allowance_amount` real,
	`allowances` text
);
--> statement-breakpoint
CREATE TABLE `missions` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`project_id` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`mission_type_id` text,
	`status` text DEFAULT 'Pending',
	`notes` text,
	`allowances` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mission_type_id`) REFERENCES `mission_types`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payroll_results` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_run_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`iqama_number` text,
	`work_type` text,
	`payment_method` text,
	`bank_account` text,
	`bank_code` text,
	`basic_salary` real,
	`housing_allowance` real,
	`gross_base` real,
	`total_income` real,
	`overtime_value` real,
	`absence_deduction` real,
	`total_deductions` real,
	`salary_received` real,
	`bank_received` real,
	`other_earnings` real,
	`bank_export_amount` real,
	`cash_export_amount` real,
	`net_salary` real,
	FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`status` text DEFAULT 'Draft',
	`total_net` real,
	`employee_count` integer,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `project_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`parent_task_id` text,
	`title` text NOT NULL,
	`description` text,
	`phase` text,
	`sub_phase` text,
	`status` text DEFAULT 'Pending',
	`creator_id` text,
	`assigned_to_ids` text,
	`start_date` text,
	`end_date` text,
	`estimated_hours` real,
	`sub_tasks` text,
	`attachments` text,
	`comments` text,
	`workflow_log` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_project_id` text,
	`client_name` text,
	`description` text,
	`details` text,
	`project_manager_id` text,
	`team_leader_id` text,
	`consultant_tl_id` text,
	`developer_tl_id` text,
	`phases` text,
	`start_date` text,
	`end_date` text,
	`status` text DEFAULT 'Active',
	`scope` text,
	`visitFollowUps` text,
	`chat` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `system_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`user_name` text,
	`action` text NOT NULL,
	`entity` text,
	`entity_id` text,
	`details` text,
	`timestamp` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_name` text DEFAULT 'Salarix System' NOT NULL,
	`logo_url` text,
	`lock_password` text,
	`idle_timeout_minutes` integer DEFAULT 5,
	`is_lock_enabled` integer DEFAULT false,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`month` text NOT NULL,
	`actual_work_days` integer,
	`basic_salary` real,
	`housing_allowance` real,
	`transport_allowance` real,
	`subsistence_allowance` real,
	`other_allowances` real,
	`mobile_allowance` real,
	`management_allowance` real,
	`mission_allowance` real,
	`other_income` real,
	`overtime_hours` real,
	`overtime_value` real,
	`total_income` real,
	`social_insurance` real,
	`salary_received` real,
	`loans` real,
	`bank_received` real,
	`other_deductions` real,
	`deduction_hours` real,
	`departure_delay_deduction` real,
	`absence_days` real,
	`absence_deduction` real,
	`total_deductions` real,
	`net_salary` real,
	`status` text,
	`salary_increase` real,
	`notes` text,
	`daily_work_hours` integer,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `wifi_attendance_networks` (
	`id` text PRIMARY KEY NOT NULL,
	`network_name` text NOT NULL,
	`ssid` text,
	`public_ip` text,
	`gateway_ip` text,
	`allowed_ip_start` text,
	`allowed_ip_end` text,
	`branch_id` text,
	`applies_to_type` text,
	`applies_to_value` text,
	`verification_mode` text,
	`is_active` integer DEFAULT true,
	`allow_check_in` integer DEFAULT true,
	`allow_check_out` integer DEFAULT true,
	`notes` text,
	`created_by` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_by` text,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
