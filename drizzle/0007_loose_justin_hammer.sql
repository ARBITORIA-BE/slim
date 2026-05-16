-- ADR-0005 §Amendment 1 (2026-05-16): landline 행 방어적 DELETE (D-1 흔적 제거).
-- 레포 전수 확인 결과 시드/픽스처/실데이터 landline 행 = 0건이나 idempotent 보호.
-- USING CAST 이전에 실행해야 'landline' 텍스트가 존재하는 경우를 방어할 수 있음.
DELETE FROM "public"."comparison_request" WHERE "category" = 'landline';--> statement-breakpoint
DELETE FROM "public"."tariff" WHERE "category" = 'landline';--> statement-breakpoint
ALTER TABLE "public"."tariff" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "public"."comparison_request" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."tariff_category";--> statement-breakpoint
CREATE TYPE "public"."tariff_category" AS ENUM('mobile', 'internet_fixed', 'bundle_internet_tv');--> statement-breakpoint
ALTER TABLE "public"."tariff" ALTER COLUMN "category" SET DATA TYPE "public"."tariff_category" USING "category"::"public"."tariff_category";--> statement-breakpoint
ALTER TABLE "public"."comparison_request" ALTER COLUMN "category" SET DATA TYPE "public"."tariff_category" USING "category"::"public"."tariff_category";