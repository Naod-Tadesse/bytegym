CREATE TYPE "payment_kind" AS ENUM('membership', 'registration', 'other');--> statement-breakpoint
CREATE TYPE "payment_method" AS ENUM('cash', 'telebirr', 'cbe_birr', 'bank_transfer', 'card');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"member_id" uuid NOT NULL,
	"membership_id" uuid,
	"branch_id" uuid NOT NULL,
	"kind" "payment_kind" DEFAULT 'membership'::"payment_kind" NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"method" "payment_method" NOT NULL,
	"reference" varchar(80),
	"received_by_staff_id" uuid NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" varchar(255),
	"voided_at" timestamp with time zone,
	"voided_by_staff_id" uuid,
	"void_reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "payments_membership_idx" ON "payments" ("membership_id");--> statement-breakpoint
CREATE INDEX "payments_member_received_idx" ON "payments" ("member_id","received_at");--> statement-breakpoint
CREATE INDEX "payments_branch_received_idx" ON "payments" ("branch_id","received_at");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_id_member_person_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("person_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_membership_id_memberships_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "memberships"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_staff_id_staff_person_id_fkey" FOREIGN KEY ("received_by_staff_id") REFERENCES "staff"("person_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_staff_id_staff_person_id_fkey" FOREIGN KEY ("voided_by_staff_id") REFERENCES "staff"("person_id");