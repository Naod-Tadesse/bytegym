CREATE TYPE "sms_kind" AS ENUM('direct', 'bulk', 'reminder');--> statement-breakpoint
CREATE TYPE "sms_status" AS ENUM('sent', 'failed', 'held');--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"phone" varchar(30) NOT NULL,
	"member_id" uuid,
	"body" text NOT NULL,
	"kind" "sms_kind" NOT NULL,
	"status" "sms_status" NOT NULL,
	"error" text,
	"sent_by_staff_id" uuid,
	"sent_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_settings" (
	"id" varchar(16) PRIMARY KEY DEFAULT 'default',
	"reminder_enabled" boolean DEFAULT false NOT NULL,
	"reminder_days_before" integer DEFAULT 7 NOT NULL,
	"reminder_template" text DEFAULT 'Hi {{name}}, your gym membership ends on {{date}} ({{days}} days left). Renew at the front desk to keep training.' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_staff_id" uuid,
	CONSTRAINT "sms_settings_singleton" CHECK ("id" = 'default'),
	CONSTRAINT "sms_settings_days_before_sane" CHECK ("reminder_days_before" between 1 and 365)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "sms_reminder_once_per_day" ON "sms_messages" ("member_id","sent_on") WHERE "kind" = 'reminder';--> statement-breakpoint
CREATE INDEX "sms_messages_member_idx" ON "sms_messages" ("member_id","created_at");--> statement-breakpoint
CREATE INDEX "sms_messages_sent_on_idx" ON "sms_messages" ("sent_on");--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_member_id_member_person_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("person_id");--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_sent_by_staff_id_staff_person_id_fkey" FOREIGN KEY ("sent_by_staff_id") REFERENCES "staff"("person_id");--> statement-breakpoint
ALTER TABLE "sms_settings" ADD CONSTRAINT "sms_settings_updated_by_staff_id_staff_person_id_fkey" FOREIGN KEY ("updated_by_staff_id") REFERENCES "staff"("person_id");