CREATE TYPE "public"."currency" AS ENUM('EUR');--> statement-breakpoint
CREATE TYPE "public"."tariff_category" AS ENUM('mobile', 'internet_fixed', 'bundle_internet_tv', 'landline');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tariff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"category" "tariff_category" NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"currency" "currency" DEFAULT 'EUR' NOT NULL,
	"monthly_price_cents" bigint NOT NULL,
	"activation_fee_cents" bigint DEFAULT 0 NOT NULL,
	"modem_rental_cents" bigint,
	"commitment_months" integer DEFAULT 0 NOT NULL,
	"early_termination_fee_cents" bigint,
	"promo_price_cents" bigint,
	"promo_months" integer,
	"promo_description" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"source_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tariff" ADD CONSTRAINT "tariff_provider_id_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tariff_provider_slug_unique" ON "tariff" USING btree ("provider_id","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tariff_category_active_idx" ON "tariff" USING btree ("category","is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tariff_provider_idx" ON "tariff" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tariff_last_seen_idx" ON "tariff" USING btree ("last_seen_at");