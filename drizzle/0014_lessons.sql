CREATE TABLE `lesson_results` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`shareId` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`answers` text NOT NULL,
	`correct` int NOT NULL,
	`total` int NOT NULL,
	`createdAt` timestamp(3) DEFAULT (now()),
	CONSTRAINT `lesson_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `lesson_results_share_profile` UNIQUE(`shareId`,`profileId`)
);
--> statement-breakpoint
CREATE TABLE `lesson_shares` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`classId` varchar(64) NOT NULL,
	`lessonId` varchar(64) NOT NULL,
	`dueDate` varchar(10),
	`createdAt` timestamp(3) DEFAULT (now()),
	`archivedAt` timestamp(3),
	CONSTRAINT `lesson_shares_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`title` varchar(200) NOT NULL,
	`subject` varchar(30) NOT NULL,
	`grade` int NOT NULL,
	`language` varchar(2) NOT NULL,
	`topic` varchar(300) NOT NULL,
	`durationMin` int NOT NULL DEFAULT 45,
	`sourceText` text,
	`content` longtext NOT NULL,
	`createdAt` timestamp(3) DEFAULT (now()),
	`updatedAt` timestamp(3) DEFAULT (now()),
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`)
);
