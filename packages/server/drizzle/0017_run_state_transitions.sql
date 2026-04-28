DROP TABLE "run_approvals";
--> statement-breakpoint
ALTER TABLE "runs" DROP COLUMN "status";
--> statement-breakpoint
CREATE TABLE "run_state_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"transitioned_from" text,
	"transitioned_to" text NOT NULL,
	"transitioned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transitioned_by_user_id" uuid,
	"transitioned_by_service" text,
	CONSTRAINT "actor_xor" CHECK (("transitioned_by_user_id" IS NOT NULL) != ("transitioned_by_service" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "run_state_transitions" ADD CONSTRAINT "run_state_transitions_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "run_state_transitions" ADD CONSTRAINT "run_state_transitions_transitioned_by_user_id_users_id_fk" FOREIGN KEY ("transitioned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
