CREATE TYPE "public"."affiliate_status" AS ENUM('none', 'pending', 'active_b2b_intra_eu', 'active_b2b_domestic_be', 'paused', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."country" AS ENUM('BE', 'NL', 'LU');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" "country" NOT NULL,
	"name" text NOT NULL,
	"legal_name" text NOT NULL,
	"slug" text NOT NULL,
	"vat_id" text,
	"vat_id_verified_at" timestamp with time zone,
	"website" text NOT NULL,
	"affiliate_status" "affiliate_status" DEFAULT 'none' NOT NULL,
	"excluded_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_slug_unique" ON "provider" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_vat_id_unique" ON "provider" USING btree ("vat_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "provider_name_country_unique" ON "provider" USING btree ("name","country");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_affiliate_status_idx" ON "provider" USING btree ("affiliate_status");