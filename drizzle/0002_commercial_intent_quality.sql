ALTER TABLE `execution_logs` MODIFY COLUMN `profilesRun` json;
--> statement-breakpoint
ALTER TABLE `execution_logs` MODIFY COLUMN `logDetails` json;
--> statement-breakpoint
ALTER TABLE `opportunities` MODIFY COLUMN `relevanceLabel` enum('high','medium','low','irrelevant') DEFAULT 'irrelevant';
--> statement-breakpoint
ALTER TABLE `opportunities` MODIFY COLUMN `detectedKeywords` json;
--> statement-breakpoint
ALTER TABLE `opportunities` MODIFY COLUMN `userFeedback` enum('relevant','irrelevant');
--> statement-breakpoint
ALTER TABLE `search_profiles` MODIFY COLUMN `keywords` json NOT NULL;
--> statement-breakpoint
ALTER TABLE `execution_logs`
  ADD `totalReview` int DEFAULT 0,
  ADD `totalDiscarded` int DEFAULT 0,
  ADD `totalPending` int DEFAULT 0,
  ADD `totalDuplicates` int DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `opportunities`
  ADD `classificationDecision` enum('qualified','review','discarded','pending') NOT NULL DEFAULT 'pending',
  ADD `classificationConfidence` float DEFAULT 0,
  ADD `commercialScore` float DEFAULT 0,
  ADD `classificationVersion` varchar(64) DEFAULT 'legacy',
  ADD `authorSide` enum('buyer','provider','intermediary','job_seeker','unknown') DEFAULT 'unknown',
  ADD `serviceCategories` json,
  ADD `classificationEvidence` json,
  ADD `exclusionReasons` json,
  ADD `dedupeKey` varchar(255),
  ADD `feedbackReason` varchar(128);
--> statement-breakpoint
CREATE INDEX `opportunities_decision_score_idx` ON `opportunities` (`classificationDecision`,`commercialScore`);
--> statement-breakpoint
CREATE INDEX `opportunities_dedupe_key_idx` ON `opportunities` (`dedupeKey`);
