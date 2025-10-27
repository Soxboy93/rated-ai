CREATE TABLE `study_reminders` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`preferredTime` varchar(10),
	`enabled` boolean DEFAULT true,
	`streak` int DEFAULT 0,
	`lastStudyDate` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `study_reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weekly_summaries` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`weekStart` timestamp NOT NULL,
	`weekEnd` timestamp NOT NULL,
	`totalMessages` int NOT NULL,
	`totalSessions` int NOT NULL,
	`topicsCovered` text,
	`strengths` text,
	`areasToImprove` text,
	`recommendations` text,
	`emailSent` boolean DEFAULT false,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `weekly_summaries_id` PRIMARY KEY(`id`)
);
