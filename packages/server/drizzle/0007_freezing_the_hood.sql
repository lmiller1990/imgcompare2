ALTER TABLE "runs" ALTER COLUMN "runNumber" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_runNumber_unique" UNIQUE("project_id","runNumber");