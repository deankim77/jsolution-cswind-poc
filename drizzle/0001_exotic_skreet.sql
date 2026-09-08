ALTER TABLE `common_codes` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `common_codes_version_uq` ON `common_codes` (`company_id`,`group_code`,`code`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `projects_company_code_uq` ON `projects` (`company_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `roles_company_code_uq` ON `roles` (`company_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `template_versions_template_version_uq` ON `template_versions` (`template_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `templates_company_code_uq` ON `templates` (`company_id`,`code`);