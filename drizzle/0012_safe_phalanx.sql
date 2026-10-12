CREATE TABLE `child_badges` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`badgeId` varchar(40) NOT NULL,
	`earnedAt` timestamp(3) DEFAULT (now()),
	CONSTRAINT `child_badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `child_badges_profile_badge` UNIQUE(`profileId`,`badgeId`)
);
--> statement-breakpoint
CREATE TABLE `child_progress` (
	`profileId` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`xp` int NOT NULL DEFAULT 0,
	`streakDays` int NOT NULL DEFAULT 0,
	`longestStreak` int NOT NULL DEFAULT 0,
	`lastPlayDate` varchar(10),
	`updatedAt` timestamp(3) DEFAULT (now()),
	CONSTRAINT `child_progress_profileId` PRIMARY KEY(`profileId`)
);
--> statement-breakpoint
CREATE TABLE `game_plays` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`game` varchar(20) NOT NULL,
	`level` int NOT NULL DEFAULT 1,
	`correct` int NOT NULL,
	`total` int NOT NULL,
	`durationMs` int NOT NULL DEFAULT 0,
	`xpEarned` int NOT NULL DEFAULT 0,
	`createdAt` timestamp(3) DEFAULT (now()),
	CONSTRAINT `game_plays_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mood_checkins` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`mood` varchar(20) NOT NULL,
	`note` varchar(200),
	`flagged` enum('safe','review','blocked') DEFAULT 'safe',
	`createdAt` timestamp(3) DEFAULT (now()),
	CONSTRAINT `mood_checkins_id` PRIMARY KEY(`id`)
);
