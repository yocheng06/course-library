CREATE TABLE `builtin_question_edits` (
	`id` text PRIMARY KEY NOT NULL,
	`course` text NOT NULL,
	`question_id` text NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL,
	`previous_data` text NOT NULL,
	`base_hash` text NOT NULL,
	`action` text NOT NULL,
	`note` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `builtin_edits_question_revision` ON `builtin_question_edits` (`course`,`question_id`,`revision`);