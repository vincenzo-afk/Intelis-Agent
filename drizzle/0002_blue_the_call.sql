CREATE TABLE `entity_change_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityId` int NOT NULL,
	`taskId` int NOT NULL,
	`runId` int NOT NULL,
	`userId` int NOT NULL,
	`changeType` enum('new_signal','updated_signal','anomaly') NOT NULL,
	`evidenceSummary` text NOT NULL,
	`significance` int NOT NULL,
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `entity_change_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `entity_changes_entity_idx` ON `entity_change_events` (`entityId`);--> statement-breakpoint
CREATE INDEX `entity_changes_task_idx` ON `entity_change_events` (`taskId`);--> statement-breakpoint
CREATE INDEX `entity_changes_run_idx` ON `entity_change_events` (`runId`);