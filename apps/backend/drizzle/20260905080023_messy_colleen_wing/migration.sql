CREATE TYPE "gender_type" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "account_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "data_scope" AS ENUM('branch', 'all');--> statement-breakpoint
CREATE TYPE "employment_status" AS ENUM('active', 'on_leave', 'terminated');--> statement-breakpoint
CREATE TYPE "session_audience" AS ENUM('staff', 'member');--> statement-breakpoint
CREATE TYPE "verification_purpose" AS ENUM('login_otp', 'phone_change');--> statement-breakpoint
CREATE SEQUENCE "public"."staff_code_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(120) NOT NULL UNIQUE,
	"address_line" varchar(255),
	"city" varchar(80),
	"phone" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"first_name" varchar(80) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"phone" varchar(30) NOT NULL,
	"date_of_birth" date,
	"gender" "gender_type",
	"registered_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"person_id" uuid NOT NULL UNIQUE,
	"status" "account_status" DEFAULT 'active'::"account_status" NOT NULL,
	"password_hash" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" varchar(40) NOT NULL UNIQUE,
	"name" varchar(80) NOT NULL UNIQUE,
	"can_have_account" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"person_id" uuid PRIMARY KEY,
	"staff_code" varchar(24) NOT NULL,
	"primary_branch_id" uuid NOT NULL,
	"data_scope" "data_scope" DEFAULT 'branch'::"data_scope" NOT NULL,
	"job_title_id" uuid NOT NULL,
	"employment_status" "employment_status" DEFAULT 'active'::"employment_status" NOT NULL,
	"hired_on" date NOT NULL,
	"terminated_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar(255) NOT NULL UNIQUE,
	"display_name" varchar(255) NOT NULL,
	"description" varchar(500),
	"group" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid,
	"permission_id" uuid,
	CONSTRAINT "role_permissions_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "account_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"person_id" uuid NOT NULL,
	"audience" "session_audience" DEFAULT 'staff'::"session_audience" NOT NULL,
	"access_token_hash" char(64),
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_hash" char(64) NOT NULL UNIQUE,
	"refresh_token_expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"identifier" varchar(30) NOT NULL,
	"purpose" "verification_purpose" NOT NULL,
	"code_hash" char(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "person_phone_active_uniq" ON "person" ("phone") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_code_uniq" ON "staff" ("staff_code");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_active_branch_idx" ON "staff" ("primary_branch_id","person_id") WHERE "terminated_on" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_name_active_uniq" ON "roles" ("name") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "account_roles_account_role_uniq" ON "account_roles" ("account_id","role_id");--> statement-breakpoint
CREATE INDEX "sessions_person_revoked_idx" ON "sessions" ("person_id","revoked_at");--> statement-breakpoint
CREATE INDEX "sessions_person_audience_revoked_idx" ON "sessions" ("person_id","audience","revoked_at");--> statement-breakpoint
CREATE INDEX "verification_identifier_purpose_idx" ON "verification" ("identifier","purpose");--> statement-breakpoint
CREATE INDEX "verification_expires_idx" ON "verification" ("expires_at");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_person_id_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_person_id_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_primary_branch_id_branches_id_fkey" FOREIGN KEY ("primary_branch_id") REFERENCES "branches"("id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_job_title_id_job_titles_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "job_titles"("id");--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_person_id_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE CASCADE;