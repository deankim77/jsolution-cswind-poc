CREATE TABLE `project_gate_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`gate_task_id` text NOT NULL,
	`gate_code` text NOT NULL,
	`decision` text NOT NULL,
	`note` text,
	`decided_by` text NOT NULL,
	`decided_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`),
	FOREIGN KEY (`gate_task_id`) REFERENCES `wbs_tasks`(`id`),
	FOREIGN KEY (`decided_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE INDEX `project_gate_decisions_project_gate_idx` ON `project_gate_decisions` (`project_id`,`gate_code`,`decided_at`);
