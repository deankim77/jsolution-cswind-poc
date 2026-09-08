CREATE TABLE `task_actuals` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `task_id` text NOT NULL,
  `user_id` text NOT NULL,
  `actual_date` text NOT NULL,
  `actual_hours` real DEFAULT 0 NOT NULL,
  `progress` integer DEFAULT 0 NOT NULL,
  `work_note` text,
  `completed` integer DEFAULT 0 NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`),
  FOREIGN KEY (`task_id`) REFERENCES `wbs_tasks`(`id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `task_actuals_project_task_idx` ON `task_actuals` (`project_id`,`task_id`,`actual_date`);
