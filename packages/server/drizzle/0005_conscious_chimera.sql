CREATE TABLE "run_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"branch" text NOT NULL,
	"commit_hash" text NOT NULL,
	"author" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_sources_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "runNumber" integer NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "runs_runNumber_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "run_sources" ADD CONSTRAINT "run_sources_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;