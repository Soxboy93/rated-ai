CREATE TABLE `progressMetrics` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`date` timestamp DEFAULT (now()),
	`mathScore` int,
	`scienceScore` int,
	`englishScore` int,
	`historyScore` int,
	`readingLevel` varchar(50),
	`totalMessages` int,
	`totalMinutes` int,
	`achievementsEarned` int,
	CONSTRAINT `progressMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reportCards` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`childName` varchar(255),
	`periodStart` timestamp,
	`periodEnd` timestamp,
	`overallGrade` varchar(10),
	`mathGrade` varchar(10),
	`scienceGrade` varchar(10),
	`englishGrade` varchar(10),
	`historyGrade` varchar(10),
	`strengths` text,
	`weaknesses` text,
	`recommendations` text,
	`totalMessages` int,
	`totalSessions` int,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `reportCards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smartMoments` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`childName` varchar(255),
	`question` text,
	`aiResponse` text,
	`category` varchar(100),
	`parentNotified` boolean DEFAULT false,
	`parentReply` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `smartMoments_id` PRIMARY KEY(`id`)
);
