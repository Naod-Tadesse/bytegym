ALTER TABLE "membership_plans" DROP CONSTRAINT "membership_plans_name_key";--> statement-breakpoint
CREATE UNIQUE INDEX "membership_plans_name_lower_uniq" ON "membership_plans" (lower("name"));