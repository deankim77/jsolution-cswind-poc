CREATE TABLE IF NOT EXISTS `partner_profiles` (`partner_id` text PRIMARY KEY NOT NULL,`english_name` text,`country` text,`industry` text,`representative_name` text,`business_registration_number` text,`address` text,`main_phone` text,`extra` text,`note` text,`updated_at` integer NOT NULL,FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE CASCADE);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `project_role_catalog` (`id` text PRIMARY KEY NOT NULL,`company_id` text NOT NULL,`code` text NOT NULL,`name` text NOT NULL,`group_name` text NOT NULL,`required` integer DEFAULT 0 NOT NULL,`enabled` integer DEFAULT 1 NOT NULL,`sort_order` integer DEFAULT 0 NOT NULL,`created_at` integer NOT NULL,`updated_at` integer NOT NULL,FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `project_role_catalog_company_code_uq` ON `project_role_catalog` (`company_id`,`code`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `project_profiles` (`project_id` text PRIMARY KEY NOT NULL,`description` text,`reference_code` text,`visibility` text DEFAULT 'company' NOT NULL,`updated_at` integer NOT NULL,FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `project_shares` (`project_id` text NOT NULL,`organization_id` text NOT NULL,`created_at` integer NOT NULL,PRIMARY KEY (`project_id`,`organization_id`),FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `saved_filters` (`id` text PRIMARY KEY NOT NULL,`company_id` text NOT NULL,`user_id` text NOT NULL,`workspace` text NOT NULL,`name` text NOT NULL,`definition` text NOT NULL,`is_default` integer DEFAULT 0 NOT NULL,`created_at` integer NOT NULL,`updated_at` integer NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `saved_filters_user_workspace_idx` ON `saved_filters` (`company_id`,`user_id`,`workspace`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `workspace_tabs` (`user_id` text NOT NULL,`tab_id` text NOT NULL,`workspace` text NOT NULL,`title` text NOT NULL,`context` text NOT NULL,`sort_order` integer DEFAULT 0 NOT NULL,`is_active` integer DEFAULT 0 NOT NULL,`updated_at` integer NOT NULL,PRIMARY KEY (`user_id`,`tab_id`));
