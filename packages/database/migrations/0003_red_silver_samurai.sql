UPDATE "rankings"
SET "slug" = '90s-mainland-top-100', "updated_at" = now()
WHERE "slug" = '90s-mainland-bilibili-top-100';--> statement-breakpoint
DROP INDEX "rankings_published_decade_region_unique";--> statement-breakpoint
ALTER TABLE "rankings" ALTER COLUMN "decade_start" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rankings" ALTER COLUMN "region" DROP NOT NULL;
