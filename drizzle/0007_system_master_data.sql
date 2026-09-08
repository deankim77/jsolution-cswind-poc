CREATE TABLE IF NOT EXISTS `partners` (`id` text PRIMARY KEY NOT NULL,`company_id` text NOT NULL,`code` text NOT NULL,`name` text NOT NULL,`category` text,`contact_name` text,`email` text,`phone` text,`status` text DEFAULT 'active' NOT NULL,`created_at` integer NOT NULL,`updated_at` integer NOT NULL,FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `partners_company_code_uq` ON `partners` (`company_id`,`code`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `project_types` (`id` text PRIMARY KEY NOT NULL,`company_id` text NOT NULL,`code` text NOT NULL,`name` text NOT NULL,`description` text,`status` text DEFAULT 'active' NOT NULL,`created_at` integer NOT NULL,`updated_at` integer NOT NULL,FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `project_types_company_code_uq` ON `project_types` (`company_id`,`code`);
--> statement-breakpoint
ALTER TABLE `projects` ADD `partner_id` text;
--> statement-breakpoint
ALTER TABLE `projects` ADD `project_type_id` text;
