CREATE TABLE `accessibility_settings` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`dyslexiaMode` int DEFAULT 0,
	`adhdMode` int DEFAULT 0,
	`autismMode` int DEFAULT 0,
	`fontSize` varchar(20) DEFAULT 'medium',
	`highContrast` int DEFAULT 0,
	`textToSpeech` int DEFAULT 0,
	`reducedMotion` int DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `accessibility_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `college_prep_progress` (
	`id` varchar(64) NOT NULL,
	`userId` varchar(64) NOT NULL,
	`testType` varchar(20) NOT NULL,
	`subject` varchar(50),
	`currentScore` int,
	`targetScore` int,
	`practiceTests` int DEFAULT 0,
	`questionsAnswered` int DEFAULT 0,
	`correctAnswers` int DEFAULT 0,
	`weakAreas` text,
	`strongAreas` text,
	`lastPracticeAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `college_prep_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `practice_questions` (
	`id` varchar(64) NOT NULL,
	`testType` varchar(20) NOT NULL,
	`subject` varchar(50) NOT NULL,
	`difficulty` varchar(20),
	`question` text NOT NULL,
	`options` text,
	`correctAnswer` varchar(10),
	`explanation` text,
	`topic` varchar(100),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `practice_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `school_integrations` (
	`id` varchar(64) NOT NULL,
	`schoolId` varchar(64) NOT NULL,
	`platform` varchar(50) NOT NULL,
	`apiKey` text,
	`accessToken` text,
	`refreshToken` text,
	`isActive` int DEFAULT 1,
	`lastSyncAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `school_integrations_id` PRIMARY KEY(`id`)
);
