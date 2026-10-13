CREATE TABLE `class_assignments` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`classId` varchar(64) NOT NULL,
	`game` varchar(20) NOT NULL,
	`level` int NOT NULL DEFAULT 1,
	`note` varchar(200),
	`dueDate` varchar(10),
	`createdAt` timestamp(3) DEFAULT (now()),
	`archivedAt` timestamp(3),
	CONSTRAINT `class_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_classes` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`name` varchar(100) NOT NULL,
	`grade` int NOT NULL,
	`createdAt` timestamp(3) DEFAULT (now()),
	CONSTRAINT `school_classes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `chatSessions` ADD `language` enum('ar','en');--> statement-breakpoint
ALTER TABLE `parental_consents` ADD `language` varchar(2);--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `classId` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `accountType` enum('family','school') DEFAULT 'family' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `language` enum('ar','en');