CREATE TYPE "public"."household_type" AS ENUM('single', 'couple', 'family_3_plus');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comparison_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_account_id" uuid,
	"category" "tariff_category" NOT NULL,
	"postal_code" text NOT NULL,
	"household_type" "household_type" NOT NULL,
	"current_provider_id" uuid,
	"input_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pii_anonymized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comparison_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"short_id" text NOT NULL,
	"top_monthly_saving_cents" bigint,
	"top_yearly_saving_cents" bigint,
	"top_tariff_snapshot_id" uuid,
	"locked_inputs" jsonb,
	"engine_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pii_anonymized_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "comparison_result_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"tariff_snapshot_id" uuid NOT NULL,
	"monthly_saving_cents" bigint NOT NULL,
	"yearly_saving_cents" bigint NOT NULL,
	"caveats" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comparison_request" ADD CONSTRAINT "comparison_request_current_provider_id_provider_id_fk" FOREIGN KEY ("current_provider_id") REFERENCES "public"."provider"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comparison_result" ADD CONSTRAINT "comparison_result_request_id_comparison_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."comparison_request"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comparison_result" ADD CONSTRAINT "comparison_result_top_tariff_snapshot_id_tariff_snapshot_id_fk" FOREIGN KEY ("top_tariff_snapshot_id") REFERENCES "public"."tariff_snapshot"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comparison_result_item" ADD CONSTRAINT "comparison_result_item_result_id_comparison_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."comparison_result"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "comparison_result_item" ADD CONSTRAINT "comparison_result_item_tariff_snapshot_id_tariff_snapshot_id_fk" FOREIGN KEY ("tariff_snapshot_id") REFERENCES "public"."tariff_snapshot"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comparison_request_category_postal_idx" ON "comparison_request" USING btree ("category","postal_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comparison_request_created_at_idx" ON "comparison_request" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comparison_request_user_account_idx" ON "comparison_request" USING btree ("user_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comparison_request_pii_anonymized_idx" ON "comparison_request" USING btree ("pii_anonymized_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "comparison_result_short_id_unique" ON "comparison_result" USING btree ("short_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comparison_result_request_idx" ON "comparison_result" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comparison_result_created_at_idx" ON "comparison_result" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comparison_result_pii_anonymized_idx" ON "comparison_result" USING btree ("pii_anonymized_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comparison_result_item_result_rank_idx" ON "comparison_result_item" USING btree ("result_id","rank");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comparison_result_item_snapshot_idx" ON "comparison_result_item" USING btree ("tariff_snapshot_id");