ALTER TABLE `attendance_logs` ADD `accuracy` real;--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `validation_details` text;--> statement-breakpoint
ALTER TABLE `attendance_logs` ADD `matched_rules` text;--> statement-breakpoint
ALTER TABLE `wifi_attendance_networks` ADD `ip_range_cidr` text;--> statement-breakpoint
ALTER TABLE `wifi_attendance_networks` ADD `latitude` real;--> statement-breakpoint
ALTER TABLE `wifi_attendance_networks` ADD `longitude` real;--> statement-breakpoint
ALTER TABLE `wifi_attendance_networks` ADD `allowed_radius_meters` integer DEFAULT 100;--> statement-breakpoint
ALTER TABLE `wifi_attendance_networks` ADD `minimum_required_matches` integer DEFAULT 2;