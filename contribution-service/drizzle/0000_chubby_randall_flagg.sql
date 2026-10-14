CREATE TABLE `public_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`fingerprint` text NOT NULL,
	`submission_id` text NOT NULL,
	`course` text NOT NULL,
	`unit` text NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `public_questions_fingerprint_unique` ON `public_questions` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `questions_course_unit` ON `public_questions` (`course`,`unit`);--> statement-breakpoint
CREATE TABLE `rate_windows` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`course` text NOT NULL,
	`unit` text NOT NULL,
	`title` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer,
	`reviewer_id` text,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `submissions_status_created` ON `submissions` (`status`,`created_at`);