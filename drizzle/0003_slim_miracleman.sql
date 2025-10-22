CREATE TABLE `achievements` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`type` varchar(50) NOT NULL,
	`title` varchar(100) NOT NULL,
	`description` text,
	`badgeImage` text,
	`earnedAt` timestamp DEFAULT (now()),
	CONSTRAINT `achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `moodEntries` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`mood` varchar(20) NOT NULL,
	`emoji` varchar(10) NOT NULL,
	`note` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `moodEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `storyCreations` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`title` varchar(200) NOT NULL,
	`content` text NOT NULL,
	`illustrations` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `storyCreations_id` PRIMARY KEY(`id`)
);
