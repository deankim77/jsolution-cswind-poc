CREATE TABLE `work_calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Seoul' NOT NULL,
	`working_days` text NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_calendars_company_default_uq` ON `work_calendars` (`company_id`,`is_default`) WHERE `is_default` = 1;
--> statement-breakpoint
CREATE TABLE `calendar_holidays` (
	`id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`holiday_date` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`calendar_id`) REFERENCES `work_calendars`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_holidays_calendar_date_uq` ON `calendar_holidays` (`calendar_id`,`holiday_date`);
