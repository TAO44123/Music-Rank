CREATE TYPE "public"."ranking_region" AS ENUM('HK_TW', 'MAINLAND');--> statement-breakpoint
ALTER TABLE "rankings" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "rankings" ADD COLUMN "decade_start" integer;--> statement-breakpoint
ALTER TABLE "rankings" ADD COLUMN "region" "ranking_region";--> statement-breakpoint
ALTER TABLE "rankings" ADD COLUMN "display_order" integer;--> statement-breakpoint
UPDATE "rankings"
SET
	"title" = '90s Demo Ranking',
	"slug" = '90s-demo-ranking',
	"decade_start" = 1990,
	"region" = 'MAINLAND',
	"display_order" = 4,
	"updated_at" = now()
WHERE "id" = 'f73c2f9e-dfd1-4777-bc5a-d55f2a0db4ae';--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "rankings"
		WHERE "slug" IS NULL
			OR "decade_start" IS NULL
			OR "region" IS NULL
			OR "display_order" IS NULL
	) THEN
		RAISE EXCEPTION 'Cannot classify unexpected legacy ranking rows; assign catalog metadata before continuing';
	END IF;
END $$;--> statement-breakpoint
ALTER TABLE "rankings" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rankings" ALTER COLUMN "decade_start" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rankings" ALTER COLUMN "region" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rankings" ALTER COLUMN "display_order" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rankings_slug_unique" ON "rankings" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "rankings_published_decade_region_unique" ON "rankings" USING btree ("decade_start","region") WHERE "rankings"."is_published" = true;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_decade_start_supported" CHECK ("rankings"."decade_start" IN (1980, 1990));--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_display_order_positive" CHECK ("rankings"."display_order" > 0);
