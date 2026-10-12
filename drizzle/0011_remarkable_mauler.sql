CREATE TABLE `audit_events` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`action` varchar(60) NOT NULL,
	`detail` varchar(255),
	`createdAt` timestamp(3) DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parental_consents` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`version` varchar(40) NOT NULL,
	`textSha256` varchar(64) NOT NULL,
	`grantedAt` timestamp(3) DEFAULT (now()),
	`revokedAt` timestamp(3),
	CONSTRAINT `parental_consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chatSessions` ADD `profileId` varchar(64);