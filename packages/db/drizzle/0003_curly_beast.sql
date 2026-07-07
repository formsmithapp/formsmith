CREATE TABLE "form_usage" (
	"form_id" uuid NOT NULL,
	"month" text NOT NULL,
	"responses" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "form_usage_form_id_month_pk" PRIMARY KEY("form_id","month")
);
--> statement-breakpoint
CREATE TABLE "workspace_ai_credits" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"remaining" integer NOT NULL,
	"granted" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_usage" ADD CONSTRAINT "form_usage_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_ai_credits" ADD CONSTRAINT "workspace_ai_credits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;