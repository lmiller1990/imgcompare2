ALTER TABLE "run_sources" RENAME COLUMN "author" TO "author_email";--> statement-breakpoint
ALTER TABLE "run_sources" ALTER COLUMN "branch" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "run_sources" ALTER COLUMN "commit_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "run_sources" ADD COLUMN "author_name" text;