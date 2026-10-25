CREATE TABLE `question_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`course` text NOT NULL,
	`question_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`detail` text NOT NULL,
	`suggestion` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	`reviewer_id` text
);
--> statement-breakpoint
CREATE INDEX `corrections_status_created` ON `question_corrections` (`status`,`created_at`);