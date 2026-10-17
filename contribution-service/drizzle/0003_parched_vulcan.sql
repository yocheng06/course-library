CREATE TABLE IF NOT EXISTS `admin_setup_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`consumed_at` text,
	CONSTRAINT "admin_setup_state_singleton" CHECK("admin_setup_state"."id" = 1)
);
