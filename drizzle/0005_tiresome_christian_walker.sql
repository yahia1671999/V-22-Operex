CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`old_value` text,
	`new_value` text,
	`timestamp` text NOT NULL,
	`ip_address` text
);
--> statement-breakpoint
CREATE TABLE `mission_allowance_run_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`employee_name` text NOT NULL,
	`mission_id` text NOT NULL,
	`mission_date_from` text,
	`mission_date_to` text,
	`mission_days` integer DEFAULT 1,
	`destination` text,
	`allowance_type` text,
	`daily_allowance_rate` real DEFAULT 0,
	`total_allowance_amount` real DEFAULT 0,
	`payment_method` text,
	`bank_account` text,
	`cash_amount` real DEFAULT 0,
	`bank_amount` real DEFAULT 0,
	`status` text DEFAULT 'Draft',
	`notes` text,
	FOREIGN KEY (`run_id`) REFERENCES `mission_allowance_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `mission_allowance_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_number` text NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`submitted_by` text,
	`submitted_at` text,
	`approved_by` text,
	`approved_at` text,
	`locked_by` text,
	`locked_at` text,
	`total_employees` integer DEFAULT 0,
	`total_missions` integer DEFAULT 0,
	`total_allowance_amount` real DEFAULT 0,
	`notes` text
);
