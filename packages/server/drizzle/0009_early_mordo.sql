ALTER TABLE "run_manifest" RENAME TO "run_manifests";--> statement-breakpoint
ALTER TABLE "run_manifests" DROP CONSTRAINT "run_manifest_run_id_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "run_manifests" ADD CONSTRAINT "run_manifests_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;