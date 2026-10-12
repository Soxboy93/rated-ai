ALTER TABLE `chatSessions` ADD `characterId` varchar(50);--> statement-breakpoint
ALTER TABLE `chatSessions` ADD `ageGroup` enum('kids','tweens','teens');--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `accessibility_settings` ADD CONSTRAINT `accessibility_settings_userId_unique` UNIQUE(`userId`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);