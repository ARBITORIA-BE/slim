ALTER TABLE "comparison_result_item" ADD COLUMN "monthly_avg_12_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comparison_result_item" ADD COLUMN "monthly_avg_24_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "comparison_result_item" ADD COLUMN "monthly_saving_24_cents" bigint DEFAULT 0 NOT NULL;