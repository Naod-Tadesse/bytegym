ALTER TABLE "membership_plans" ADD COLUMN "registration_fee" numeric(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "registration_fee" numeric(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" DROP COLUMN "kind";--> statement-breakpoint
-- Hand-added, and it has to run BEFORE the SET NOT NULL below.
--
-- A joining fee used to be a payment of its own carrying no membership id; it
-- is now `memberships.registration_fee`, part of the amount due on the period
-- sold. That leaves the existing null rows to re-home, and a payment is never
-- deleted here — a mistake is voided and the row stays — so they are attached
-- rather than dropped.
--
-- Only where the payer has EXACTLY ONE live membership, which is the case for
-- the single such row in this database. A payer with none, or with several, is
-- left null deliberately: the ALTER then fails loudly instead of the migration
-- silently crediting money against a membership somebody guessed at.
UPDATE "payments" p
SET "membership_id" = (
  SELECT m."id" FROM "memberships" m
  WHERE m."member_id" = p."member_id" AND m."deleted_at" IS NULL
)
WHERE p."membership_id" IS NULL
  AND (
    SELECT count(*) FROM "memberships" m
    WHERE m."member_id" = p."member_id" AND m."deleted_at" IS NULL
  ) = 1;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "membership_id" SET NOT NULL;--> statement-breakpoint
DROP TYPE "payment_kind";
