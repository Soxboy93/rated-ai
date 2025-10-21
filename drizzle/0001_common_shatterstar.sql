CREATE TABLE `chatMessages` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp DEFAULT (now()),
	`flagged` enum('safe','review','blocked') DEFAULT 'safe',
	CONSTRAINT `chatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chatSessions` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`childName` varchar(100),
	`createdAt` timestamp DEFAULT (now()),
	`lastMessageAt` timestamp DEFAULT (now()),
	CONSTRAINT `chatSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parentalSettings` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`password` varchar(255) NOT NULL,
	`dailyLimit` varchar(10) DEFAULT '30',
	`allowedHours` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `parentalSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `parentalSettings_userId_unique` UNIQUE(`userId`)
);
