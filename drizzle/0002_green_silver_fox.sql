ALTER TABLE `app_users` ADD `employee_id` text;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `primary_color` text DEFAULT '#0ea5e9';--> statement-breakpoint
ALTER TABLE `system_settings` ADD `secondary_color` text DEFAULT '#10b981';--> statement-breakpoint
ALTER TABLE `system_settings` ADD `sidebar_color` text DEFAULT '#0f172a';--> statement-breakpoint
ALTER TABLE `system_settings` ADD `button_color` text DEFAULT '#0ea5e9';--> statement-breakpoint
ALTER TABLE `system_settings` ADD `dark_mode_enabled` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `default_language` text DEFAULT 'ar';