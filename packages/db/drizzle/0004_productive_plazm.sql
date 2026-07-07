ALTER TABLE "forms" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;