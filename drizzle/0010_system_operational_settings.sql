CREATE TABLE IF NOT EXISTS `system_settings` (
  `company_id` text NOT NULL,
  `setting_key` text NOT NULL,
  `value` text NOT NULL,
  `updated_by` text,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`company_id`,`setting_key`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_company_created_idx` ON `audit_logs` (`company_id`,`created_at` DESC);
