CREATE TABLE "check_ins" (
	"id" bigserial PRIMARY KEY,
	"member_id" uuid NOT NULL,
	"membership_id" uuid,
	"branch_id" uuid NOT NULL,
	"recorded_by_person_id" uuid,
	"override_by_staff_id" uuid,
	"checked_in_on" date NOT NULL,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_out_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "check_ins_member_day_uniq" ON "check_ins" ("member_id","checked_in_on");--> statement-breakpoint
CREATE INDEX "check_ins_branch_day_idx" ON "check_ins" ("branch_id","checked_in_on");--> statement-breakpoint
CREATE INDEX "check_ins_membership_idx" ON "check_ins" ("membership_id");--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_member_id_member_person_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("person_id");--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id");--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_recorded_by_person_id_person_id_fkey" FOREIGN KEY ("recorded_by_person_id") REFERENCES "person"("id");--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_override_by_staff_id_staff_person_id_fkey" FOREIGN KEY ("override_by_staff_id") REFERENCES "staff"("person_id");