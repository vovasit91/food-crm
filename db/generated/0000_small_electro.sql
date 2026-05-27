-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `schema_version` (
	`version` integer NOT NULL,
	`applied_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`icon` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`icon` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tag_category` (
	`tag_id` text NOT NULL,
	`category_id` text NOT NULL,
	PRIMARY KEY(`tag_id`, `category_id`)
);
--> statement-breakpoint
CREATE TABLE `tag_kitchen_item` (
	`tag_id` text NOT NULL,
	`kitchen_item_id` text NOT NULL,
	PRIMARY KEY(`tag_id`, `kitchen_item_id`)
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`icon` text NOT NULL,
	`proteins` integer,
	`carbs` integer,
	`fats` integer,
	`g_in_measurement` real,
	`measurement` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kitchen_items` (
	`id` text PRIMARY KEY NOT NULL,
	`icon` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`image` text NOT NULL,
	`time_minutes` integer NOT NULL,
	`difficulty` text NOT NULL,
	`is_enabled` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipe_tag` (
	`recipe_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `tag_id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_kitchen_item` (
	`recipe_id` text NOT NULL,
	`kitchen_item_id` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `kitchen_item_id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_variation` (
	`recipe_id` text NOT NULL,
	`variation_recipe_id` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `variation_recipe_id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_tldr_step` (
	`recipe_id` text NOT NULL,
	`step_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`minutes` integer NOT NULL,
	PRIMARY KEY(`recipe_id`, `sort_order`)
);
--> statement-breakpoint
CREATE TABLE `recipe_ingredient` (
	`recipe_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`quantity` real,
	`unit` text,
	`optional` integer DEFAULT 0 NOT NULL,
	`portion_coefficient` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`recipe_id`, `ingredient_id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_ingredient_substitutes` (
	`recipe_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	`substitute_ingredient_id` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `ingredient_id`, `substitute_ingredient_id`)
);
--> statement-breakpoint
CREATE TABLE `recipe_cooking_step` (
	`recipe_id` text NOT NULL,
	`step` text NOT NULL,
	`sort_order` integer NOT NULL,
	`duration` integer DEFAULT 0 NOT NULL,
	`show_timer` integer DEFAULT 0 NOT NULL,
	`image` text,
	PRIMARY KEY(`recipe_id`, `sort_order`)
);
--> statement-breakpoint
CREATE TABLE `cooking_step_tag` (
	`recipe_id` text NOT NULL,
	`step` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `step`, `tag`)
);
--> statement-breakpoint
CREATE TABLE `content_version` (
	`version` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `translations` (
	`locale` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`locale`, `entity_type`, `entity_id`)
);

*/