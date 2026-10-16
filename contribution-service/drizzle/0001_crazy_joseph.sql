CREATE TABLE `content_updates` (
	`id` text PRIMARY KEY NOT NULL,
	`applied_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `question_history` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`revision` integer NOT NULL,
	`course` text NOT NULL,
	`unit` text NOT NULL,
	`data` text NOT NULL,
	`is_published` integer NOT NULL,
	`action` text NOT NULL,
	`actor` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `history_question_created` ON `question_history` (`question_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `public_questions` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `public_questions` ADD `is_published` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `public_questions` ADD `updated_at` integer;