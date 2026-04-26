CREATE TABLE "run_completions" (
	"run_id" text NOT NULL,
	"job_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runs" DROP CONSTRAINT "runs_project_id_runNumber_unique";--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "snapshotsProcessed" integer DEFAULT 0;