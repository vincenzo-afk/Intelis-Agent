CREATE TABLE `ask_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ask_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ask_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`citations` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ask_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(120) NOT NULL,
	`resourceType` varchar(80) NOT NULL,
	`resourceId` int,
	`detail` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `delivery_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`userId` int NOT NULL,
	`channel` enum('in_app','email') NOT NULL,
	`recipient` varchar(320),
	`status` enum('queued','sent','failed') NOT NULL DEFAULT 'queued',
	`detail` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `delivery_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `followed_entities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`collectionId` int,
	`name` varchar(180) NOT NULL,
	`entityType` enum('company','person','topic') NOT NULL,
	`aliases` json NOT NULL,
	`status` enum('active','paused') NOT NULL DEFAULT 'active',
	`lastObservedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `followed_entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intelligence_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`runId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`reportType` enum('summary','digest','alert') NOT NULL,
	`content` text NOT NULL,
	`format` enum('markdown','html') NOT NULL DEFAULT 'markdown',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intelligence_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intelligence_trends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`collectionId` int,
	`label` varchar(180) NOT NULL,
	`category` varchar(80) NOT NULL,
	`momentum` int NOT NULL,
	`findingCount` int NOT NULL,
	`analysis` text NOT NULL,
	`status` enum('emerging','rising','watching') NOT NULL,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intelligence_trends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`color` varchar(16) NOT NULL DEFAULT '#6E82FB',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`title` text NOT NULL,
	`sourceUrl` text NOT NULL,
	`sourceName` varchar(160) NOT NULL,
	`publishedAt` timestamp,
	`contentExcerpt` text NOT NULL,
	`summary` text NOT NULL,
	`category` varchar(80) NOT NULL,
	`entities` json NOT NULL,
	`qualityScore` int NOT NULL,
	`relevanceScore` int NOT NULL,
	`credibilityScore` int NOT NULL,
	`noveltyScore` int NOT NULL,
	`verificationStatus` enum('verified','partially_verified','unverified') NOT NULL,
	`fingerprint` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`trigger` enum('scheduled','manual','retry') NOT NULL,
	`executionProfile` enum('scheduled','high_throughput') NOT NULL,
	`status` enum('queued','running','completed','failed','partial') NOT NULL DEFAULT 'queued',
	`currentStage` varchar(40),
	`stageStates` json NOT NULL,
	`sourceCount` int NOT NULL DEFAULT 0,
	`findingCount` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`collectionId` int,
	`name` varchar(160) NOT NULL,
	`naturalLanguageRequest` text NOT NULL,
	`sources` json NOT NULL,
	`keywords` json NOT NULL,
	`topics` json NOT NULL,
	`sourceFilters` json NOT NULL,
	`cronExpression` varchar(100) NOT NULL,
	`schedule_cron_task_uid` varchar(65),
	`executionProfile` enum('scheduled','high_throughput') NOT NULL DEFAULT 'scheduled',
	`status` enum('active','paused','archived') NOT NULL DEFAULT 'active',
	`emailEnabled` boolean NOT NULL DEFAULT false,
	`deliveryEmail` varchar(320),
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `research_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `source_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`sourceUrl` text NOT NULL,
	`contentHash` varchar(128) NOT NULL,
	`contentExcerpt` text NOT NULL,
	`changeSummary` text,
	`significantChange` boolean NOT NULL DEFAULT false,
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `source_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `conversations_user_idx` ON `ask_conversations` (`userId`);--> statement-breakpoint
CREATE INDEX `messages_conversation_idx` ON `ask_messages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `audit_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `audit_resource_idx` ON `audit_logs` (`resourceType`,`resourceId`);--> statement-breakpoint
CREATE INDEX `delivery_report_idx` ON `delivery_events` (`reportId`);--> statement-breakpoint
CREATE INDEX `delivery_user_idx` ON `delivery_events` (`userId`);--> statement-breakpoint
CREATE INDEX `entities_user_idx` ON `followed_entities` (`userId`);--> statement-breakpoint
CREATE INDEX `entities_collection_idx` ON `followed_entities` (`collectionId`);--> statement-breakpoint
CREATE INDEX `reports_task_idx` ON `intelligence_reports` (`taskId`);--> statement-breakpoint
CREATE INDEX `reports_run_idx` ON `intelligence_reports` (`runId`);--> statement-breakpoint
CREATE INDEX `trends_user_idx` ON `intelligence_trends` (`userId`);--> statement-breakpoint
CREATE INDEX `trends_collection_idx` ON `intelligence_trends` (`collectionId`);--> statement-breakpoint
CREATE INDEX `collections_user_idx` ON `research_collections` (`userId`);--> statement-breakpoint
CREATE INDEX `findings_task_idx` ON `research_findings` (`taskId`);--> statement-breakpoint
CREATE INDEX `findings_run_idx` ON `research_findings` (`runId`);--> statement-breakpoint
CREATE INDEX `findings_fingerprint_idx` ON `research_findings` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `runs_task_idx` ON `research_runs` (`taskId`);--> statement-breakpoint
CREATE INDEX `runs_user_idx` ON `research_runs` (`userId`);--> statement-breakpoint
CREATE INDEX `tasks_user_idx` ON `research_tasks` (`userId`);--> statement-breakpoint
CREATE INDEX `tasks_collection_idx` ON `research_tasks` (`collectionId`);--> statement-breakpoint
CREATE INDEX `tasks_schedule_uid_idx` ON `research_tasks` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `snapshots_task_idx` ON `source_snapshots` (`taskId`);