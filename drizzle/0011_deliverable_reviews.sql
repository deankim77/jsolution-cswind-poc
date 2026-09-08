CREATE TABLE IF NOT EXISTS `deliverable_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `deliverable_id` text NOT NULL,
  `version_id` text,
  `action` text NOT NULL,
  `note` text,
  `reviewed_by` text,
  `reviewed_at` integer NOT NULL,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`),
  FOREIGN KEY (`deliverable_id`) REFERENCES `deliverables`(`id`)
);
