CREATE TABLE IF NOT EXISTS `project_baselines` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `version` integer NOT NULL,
  `name` text NOT NULL,
  `captured_at` integer NOT NULL,
  `captured_by` text,
  `is_active` integer DEFAULT 1 NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS `project_baselines_project_version_uq`
  ON `project_baselines` (`project_id`,`version`);

CREATE TABLE IF NOT EXISTS `project_baseline_tasks` (
  `baseline_id` text NOT NULL,
  `task_id` text NOT NULL,
  `wbs_code` text NOT NULL,
  `name` text NOT NULL,
  `planned_start` text,
  `planned_end` text,
  `duration_days` integer NOT NULL,
  `sort_order` integer NOT NULL,
  PRIMARY KEY (`baseline_id`,`task_id`),
  FOREIGN KEY (`baseline_id`) REFERENCES `project_baselines`(`id`) ON DELETE CASCADE
);
