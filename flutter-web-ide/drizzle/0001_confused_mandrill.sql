CREATE TABLE `build_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`step` enum('upload','extract','pub_get','build','complete','error') NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `build_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('uploading','extracting','pub_get','building','completed','failed') NOT NULL DEFAULT 'uploading',
	`buildType` enum('web','apk') NOT NULL DEFAULT 'web',
	`zipKey` varchar(512),
	`buildOutputKey` varchar(512),
	`buildOutputUrl` varchar(1024),
	`localPath` varchar(1024),
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
