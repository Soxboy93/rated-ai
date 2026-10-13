ALTER TABLE `users` ADD `suspendedAt` timestamp(3);--> statement-breakpoint
ALTER TABLE `users` ADD `suspendedReason` varchar(200);