CREATE TYPE "public"."confidence" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tariff_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tariff_id" uuid NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"source_url" text NOT NULL,
	"monthly_price_cents" bigint NOT NULL,
	"activation_fee_cents" bigint DEFAULT 0 NOT NULL,
	"modem_rental_cents" bigint,
	"promo_price_cents" bigint,
	"promo_months" integer,
	"price_payload" jsonb,
	"raw_payload" jsonb,
	"confidence" "confidence" DEFAULT 'high' NOT NULL,
	"confidence_reason" text,
	"is_anomaly" boolean DEFAULT false NOT NULL,
	"anomaly_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tariff_snapshot" ADD CONSTRAINT "tariff_snapshot_tariff_id_tariff_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariff"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tariff_snapshot_tariff_fetched_idx" ON "tariff_snapshot" USING btree ("tariff_id","fetched_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tariff_snapshot_anomaly_idx" ON "tariff_snapshot" USING btree ("is_anomaly");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tariff_snapshot_fetched_at_idx" ON "tariff_snapshot" USING btree ("fetched_at" DESC NULLS LAST);