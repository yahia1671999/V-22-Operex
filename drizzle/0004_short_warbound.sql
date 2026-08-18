CREATE TABLE `financial_advances` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`project_id` text,
	`month` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`notes` text,
	`ref_number` text,
	`created_at` text NOT NULL,
	`disbursed_at` text
);
--> statement-breakpoint
CREATE TABLE `mission_disbursals` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`month` text NOT NULL,
	`total_amount` real DEFAULT 0 NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'Draft' NOT NULL,
	`payments` text DEFAULT '[]',
	`notes` text
);
