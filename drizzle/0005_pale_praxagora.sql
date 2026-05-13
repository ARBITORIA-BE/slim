CREATE TYPE "public"."affiliate_conversion_status" AS ENUM('pending', 'converted', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "affiliate_click" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"click_token" text NOT NULL,
	"result_id" uuid,
	"result_item_id" uuid,
	"provider_id" uuid NOT NULL,
	"tariff_snapshot_id" uuid NOT NULL,
	"consent_given_at" timestamp with time zone NOT NULL,
	"ref_param" text NOT NULL,
	"commission_amount_cents" bigint,
	"commission_currency" text DEFAULT 'EUR' NOT NULL,
	"commission_source" text,
	"commission_fetched_at" timestamp with time zone,
	"conversion_status" "affiliate_conversion_status" DEFAULT 'pending' NOT NULL,
	"converted_at" timestamp with time zone,
	"payout_batch_id" text,
	"pii_anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_click_click_token_unique" UNIQUE("click_token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_click" ADD CONSTRAINT "affiliate_click_result_id_comparison_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."comparison_result"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_click" ADD CONSTRAINT "affiliate_click_result_item_id_comparison_result_item_id_fk" FOREIGN KEY ("result_item_id") REFERENCES "public"."comparison_result_item"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_click" ADD CONSTRAINT "affiliate_click_provider_id_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "affiliate_click" ADD CONSTRAINT "affiliate_click_tariff_snapshot_id_tariff_snapshot_id_fk" FOREIGN KEY ("tariff_snapshot_id") REFERENCES "public"."tariff_snapshot"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_click_token_unique" ON "affiliate_click" USING btree ("click_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_click_provider_idx" ON "affiliate_click" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_click_result_idx" ON "affiliate_click" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_click_conversion_status_idx" ON "affiliate_click" USING btree ("conversion_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "affiliate_click_pii_anonymized_idx" ON "affiliate_click" USING btree ("pii_anonymized_at");