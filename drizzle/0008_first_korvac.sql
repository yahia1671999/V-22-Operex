CREATE TABLE `performance_criteria` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`weight` real DEFAULT 10,
	`response_type` text NOT NULL,
	`description_ar` text,
	`description_en` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `performance_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`year` text NOT NULL,
	`cycle_type` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'Draft',
	`target_departments` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `performance_development_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`evaluation_id` text NOT NULL,
	`weaknesses` text,
	`training_courses` text,
	`smart_objectives` text,
	`progress_percentage` real DEFAULT 0,
	`status` text DEFAULT 'Active',
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evaluation_id`) REFERENCES `performance_evaluations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `performance_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`template_id` text NOT NULL,
	`manager_id` text,
	`dept_head_id` text,
	`hr_id` text,
	`status` text DEFAULT 'PendingSelf',
	`self_weight` real DEFAULT 10,
	`manager_weight` real DEFAULT 60,
	`dept_head_weight` real DEFAULT 20,
	`hr_weight` real DEFAULT 10,
	`self_scores` text,
	`manager_scores` text,
	`dept_head_scores` text,
	`hr_scores` text,
	`self_strengths` text,
	`self_improvements` text,
	`self_recommendations` text,
	`manager_strengths` text,
	`manager_improvements` text,
	`manager_recommendations` text,
	`dept_head_strengths` text,
	`dept_head_improvements` text,
	`dept_head_recommendations` text,
	`hr_strengths` text,
	`hr_improvements` text,
	`hr_recommendations` text,
	`final_percentage_score` real DEFAULT 0,
	`final_grade` text,
	`workflow_log` text,
	`is_self_submitted` integer DEFAULT false,
	`is_manager_submitted` integer DEFAULT false,
	`is_dept_head_approved` integer DEFAULT false,
	`is_hr_approved` integer DEFAULT false,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cycle_id`) REFERENCES `performance_cycles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`template_id`) REFERENCES `performance_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `performance_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name_ar` text NOT NULL,
	`name_en` text NOT NULL,
	`description` text,
	`job_types` text,
	`success_rate` real DEFAULT 70,
	`status` text DEFAULT 'Active',
	`sections` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_system_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_name` text DEFAULT 'Oprex System' NOT NULL,
	`logo_url` text,
	`lock_password` text,
	`idle_timeout_minutes` integer DEFAULT 5,
	`is_lock_enabled` integer DEFAULT false,
	`primary_color` text DEFAULT '#0ea5e9',
	`secondary_color` text DEFAULT '#10b981',
	`sidebar_color` text DEFAULT '#0f172a',
	`button_color` text DEFAULT '#0ea5e9',
	`dark_mode_enabled` integer DEFAULT false,
	`default_language` text DEFAULT 'ar',
	`overtime_rate` real DEFAULT 1.5,
	`delay_hourly_rate` real DEFAULT 1,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
INSERT INTO `__new_system_settings`("id", "organization_name", "logo_url", "lock_password", "idle_timeout_minutes", "is_lock_enabled", "primary_color", "secondary_color", "sidebar_color", "button_color", "dark_mode_enabled", "default_language", "overtime_rate", "delay_hourly_rate", "updated_at") SELECT "id", "organization_name", "logo_url", "lock_password", "idle_timeout_minutes", "is_lock_enabled", "primary_color", "secondary_color", "sidebar_color", "button_color", "dark_mode_enabled", "default_language", "overtime_rate", "delay_hourly_rate", "updated_at" FROM `system_settings`;--> statement-breakpoint
DROP TABLE `system_settings`;--> statement-breakpoint
ALTER TABLE `__new_system_settings` RENAME TO `system_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;