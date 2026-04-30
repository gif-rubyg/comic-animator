CREATE TABLE `layers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`panelId` int NOT NULL,
	`name` varchar(255) NOT NULL DEFAULT 'Layer',
	`imageUrl` text,
	`x` float NOT NULL DEFAULT 0,
	`y` float NOT NULL DEFAULT 0,
	`width` float NOT NULL DEFAULT 30,
	`height` float NOT NULL DEFAULT 50,
	`zIndex` int NOT NULL DEFAULT 0,
	`flipX` int NOT NULL DEFAULT 0,
	`animations` json DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `layers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `panels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`order` int NOT NULL DEFAULT 0,
	`backgroundUrl` text,
	`duration` float NOT NULL DEFAULT 3,
	`transition` enum('none','fade','slide-left','slide-right','zoom-in','zoom-out') NOT NULL DEFAULT 'fade',
	`transitionDuration` float NOT NULL DEFAULT 0.5,
	`panZoom` json DEFAULT ('null'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `panels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL DEFAULT 'Untitled Project',
	`aspectRatio` enum('9:16','4:3') NOT NULL DEFAULT '9:16',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
