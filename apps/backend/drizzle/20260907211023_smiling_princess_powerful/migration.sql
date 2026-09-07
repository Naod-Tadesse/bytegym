ALTER TABLE "branches" DROP CONSTRAINT "branches_name_key";--> statement-breakpoint
ALTER TABLE "job_titles" DROP CONSTRAINT "job_titles_name_key";--> statement-breakpoint
DROP INDEX "roles_name_active_uniq";--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_active_uniq" ON "roles" (lower("name")) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "branches_name_lower_uniq" ON "branches" (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "job_titles_name_lower_uniq" ON "job_titles" (lower("name"));