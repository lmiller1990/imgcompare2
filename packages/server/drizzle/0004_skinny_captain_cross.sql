ALTER TABLE "comparisons" DROP CONSTRAINT "comparisons_snapshot_id_snapshots_id_fk";
--> statement-breakpoint
ALTER TABLE "comparisons" ADD COLUMN "base_snapshot_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_base_snapshot_id_snapshots_id_fk" FOREIGN KEY ("base_snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparisons" DROP COLUMN "snapshot_id";