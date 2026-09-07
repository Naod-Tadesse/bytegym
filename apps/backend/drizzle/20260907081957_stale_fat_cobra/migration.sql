CREATE SEQUENCE "public"."member_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "member" (
	"person_id" uuid PRIMARY KEY,
	"member_code" varchar(24) NOT NULL,
	"branch_id" uuid NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"emergency_contact_name" varchar(120),
	"emergency_contact_phone" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "member_code_uniq" ON "member" ("member_code");--> statement-breakpoint
CREATE INDEX "member_branch_idx" ON "member" ("branch_id");--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_person_id_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id");--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");