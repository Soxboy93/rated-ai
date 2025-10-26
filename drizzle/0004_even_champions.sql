CREATE TABLE `challengeParticipants` (
	`id` varchar(64) NOT NULL,
	`challengeId` varchar(64),
	`userId` varchar(64),
	`userName` varchar(100),
	`score` int DEFAULT 0,
	`completed` boolean DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `challengeParticipants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `familyChallenges` (
	`id` varchar(64) NOT NULL,
	`title` varchar(200),
	`description` text,
	`type` varchar(50),
	`difficulty` varchar(20),
	`questions` text,
	`startDate` timestamp,
	`endDate` timestamp,
	`active` boolean DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `familyChallenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `homeworkSubmissions` (
	`id` varchar(64) NOT NULL,
	`sessionId` varchar(64),
	`userId` varchar(64) NOT NULL,
	`subject` varchar(50),
	`question` text,
	`imageUrl` text,
	`solution` text,
	`steps` text,
	`difficulty` varchar(20),
	`completed` boolean DEFAULT false,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `homeworkSubmissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learningStreaks` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`currentStreak` int DEFAULT 0,
	`longestStreak` int DEFAULT 0,
	`lastActivityDate` timestamp DEFAULT (now()),
	`freezesAvailable` int DEFAULT 2,
	`totalPoints` int DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `learningStreaks_id` PRIMARY KEY(`id`),
	CONSTRAINT `learningStreaks_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `quests` (
	`id` varchar(64) NOT NULL,
	`title` varchar(200),
	`description` text,
	`category` varchar(50),
	`difficulty` int DEFAULT 1,
	`requiredLevel` int DEFAULT 1,
	`rewards` text,
	`tasks` text,
	`active` boolean DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `quests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `readingSessions` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`text` text,
	`audioUrl` text,
	`transcription` text,
	`readingLevel` varchar(20),
	`accuracy` int,
	`wordsPerMinute` int,
	`comprehensionScore` int,
	`feedback` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `readingSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userQuests` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`questId` varchar(64),
	`progress` int DEFAULT 0,
	`completed` boolean DEFAULT false,
	`completedAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `userQuests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `virtualPets` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`name` varchar(100),
	`type` varchar(50),
	`level` int DEFAULT 1,
	`experience` int DEFAULT 0,
	`happiness` int DEFAULT 100,
	`hunger` int DEFAULT 0,
	`evolution` varchar(50) DEFAULT 'baby',
	`lastFed` timestamp DEFAULT (now()),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `virtualPets_id` PRIMARY KEY(`id`),
	CONSTRAINT `virtualPets_userId_unique` UNIQUE(`userId`)
);
