CREATE TABLE IF NOT EXISTS "follow_up_email" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_click_id" uuid NOT NULL,
	"email" text,
	"consent_given_at" timestamp with time zone NOT NULL,
	"scheduled_send_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"unsubscribe_token" text NOT NULL,
	"pii_anonymized_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_email_unsubscribe_token_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "follow_up_email" ADD CONSTRAINT "follow_up_email_affiliate_click_id_affiliate_click_id_fk" FOREIGN KEY ("affiliate_click_id") REFERENCES "public"."affiliate_click"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "follow_up_email_unsubscribe_token_unique" ON "follow_up_email" USING btree ("unsubscribe_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_up_email_schedule_idx" ON "follow_up_email" USING btree ("scheduled_send_at","sent_at");