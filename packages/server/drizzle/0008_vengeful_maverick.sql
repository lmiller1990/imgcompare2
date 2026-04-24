CREATE TABLE "run_manifest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"manifest" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "run_manifest" ADD CONSTRAINT "run_manifest_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;