CREATE TYPE "data_scope" AS ENUM('branch', 'all');--> statement-breakpoint
ALTER TABLE "staff_profiles" ADD COLUMN "data_scope" "data_scope" DEFAULT 'branch'::"data_scope" NOT NULL;