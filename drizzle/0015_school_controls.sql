ALTER TABLE `chatMessages` ADD `reviewedAt` timestamp(3);--> statement-breakpoint
ALTER TABLE `school_classes` ADD `chatEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `school_classes` ADD `searchEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `school_classes` ADD `focusMode` boolean DEFAULT false NOT NULL;