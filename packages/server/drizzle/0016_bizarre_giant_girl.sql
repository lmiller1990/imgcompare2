CREATE TABLE "ci_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ci_tokens_project_id_provider_unique" UNIQUE("project_id","provider")
);
--> statement-breakpoint
ALTER TABLE "ci_tokens" ADD CONSTRAINT "ci_tokens_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "ci_token_ciphertext";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "ci_token_provider";