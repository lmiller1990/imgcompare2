CREATE TABLE "client_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"client_secret_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "client_credentials_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
ALTER TABLE "client_credentials" ADD CONSTRAINT "client_credentials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;