CREATE TABLE `classrooms` (
	`id` varchar(64) NOT NULL,
	`teacherId` varchar(64) NOT NULL,
	`name` varchar(200) NOT NULL,
	`gradeLevel` varchar(50),
	`subject` varchar(100),
	`studentCount` int DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `classrooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `curriculum_standards` (
	`id` varchar(64) NOT NULL,
	`messageId` varchar(64) NOT NULL,
	`standardCode` varchar(50) NOT NULL,
	`standardDescription` text,
	`subject` varchar(50),
	`gradeLevel` varchar(20),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `curriculum_standards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `peer_challenges` (
	`id` varchar(64) NOT NULL,
	`creatorId` varchar(64) NOT NULL,
	`challengerId` varchar(64),
	`challengeType` varchar(50),
	`subject` varchar(50),
	`difficulty` varchar(20),
	`creatorScore` int DEFAULT 0,
	`challengerScore` int DEFAULT 0,
	`status` varchar(20) DEFAULT 'pending',
	`winnerId` varchar(64),
	`createdAt` timestamp DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `peer_challenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teachers` (
	`id` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`school` varchar(200),
	`gradeLevel` varchar(50),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `teachers_id` PRIMARY KEY(`id`)
);
