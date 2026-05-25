CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`subject` varchar(512) NOT NULL,
	`bodyHtml` text NOT NULL,
	`bodyText` text,
	`supportImageUrl` varchar(1024),
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `execution_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggeredBy` enum('manual','scheduled') NOT NULL DEFAULT 'manual',
	`status` enum('running','completed','failed','partial') NOT NULL DEFAULT 'running',
	`profilesRun` json DEFAULT ('[]'),
	`totalFound` int DEFAULT 0,
	`totalClassified` int DEFAULT 0,
	`totalOpportunities` int DEFAULT 0,
	`totalEmailsSent` int DEFAULT 0,
	`errorMessage` text,
	`logDetails` json DEFAULT ('[]'),
	`durationMs` int,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `execution_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `feedback_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pattern` text NOT NULL,
	`patternType` enum('keyword','phrase','regex') DEFAULT 'phrase',
	`signal` enum('positive','negative') NOT NULL,
	`weight` float DEFAULT 1,
	`occurrences` int DEFAULT 1,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `feedback_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionLogId` int,
	`searchProfileId` int,
	`linkedinUrl` varchar(1024),
	`authorName` varchar(255),
	`authorTitle` varchar(512),
	`authorCompany` varchar(255),
	`authorProfileUrl` varchar(1024),
	`contentType` enum('post','comment','article','other') DEFAULT 'post',
	`rawText` text NOT NULL,
	`publishedAt` timestamp,
	`relevanceScore` float DEFAULT 0,
	`relevanceLabel` enum('high','medium','low','irrelevant') DEFAULT 'medium',
	`classificationReason` text,
	`detectedKeywords` json DEFAULT ('[]'),
	`intentCategory` varchar(128),
	`status` enum('new','reviewed','contacted','discarded') DEFAULT 'new',
	`userFeedback` enum('relevant','irrelevant') DEFAULT null,
	`feedbackNote` text,
	`feedbackAt` timestamp,
	`emailSentAt` timestamp,
	`country` varchar(100),
	`city` varchar(100),
	`searchKeyword` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `opportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `schedule_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`cronExpression` varchar(64) NOT NULL,
	`hourColombia` varchar(8),
	`isEnabled` boolean NOT NULL DEFAULT true,
	`scheduleCronTaskUid` varchar(65),
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `schedule_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `schedule_jobs_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `search_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`country` varchar(100),
	`city` varchar(100),
	`keywords` json NOT NULL DEFAULT ('[]'),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `search_profiles_id` PRIMARY KEY(`id`)
);
