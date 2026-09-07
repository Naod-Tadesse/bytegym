CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"member_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"starts_on" date DEFAULT current_date NOT NULL,
	"ends_on" date NOT NULL,
	"price" numeric(12,2) NOT NULL,
	"is_complimentary" boolean DEFAULT false NOT NULL,
	"sold_by_staff_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "memberships_member_ends_idx" ON "memberships" ("member_id","ends_on");--> statement-breakpoint
CREATE INDEX "memberships_ends_on_idx" ON "memberships" ("ends_on");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_member_id_member_person_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("person_id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_plan_id_membership_plans_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id");--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_sold_by_staff_id_staff_person_id_fkey" FOREIGN KEY ("sold_by_staff_id") REFERENCES "staff"("person_id");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_no_overlap"
  EXCLUDE USING gist (
    member_id WITH =,
    daterange(starts_on, ends_on, '[]') WITH &&
  ) WHERE (deleted_at IS NULL);