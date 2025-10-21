CREATE TABLE `learningProgress` (
	`id` varchar(64) NOT NULL,
	`profileId` varchar(64) NOT NULL,
	`module` varchar(50) NOT NULL,
	`progress` varchar(10) DEFAULT '0',
	`lastAccessed` timestamp DEFAULT (now()),
	CONSTRAINT `learningProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userProfiles` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`childName` varchar(100) NOT NULL,
	`ageGroup` enum('kids','tweens','teens') NOT NULL,
	`selectedCharacter` varchar(50),
	`avatar` varchar(10),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `userProfiles_id` PRIMARY KEY(`id`)
);
