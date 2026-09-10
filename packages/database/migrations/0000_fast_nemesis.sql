CREATE TYPE "public"."ranking_source_type" AS ENUM('DEMO', 'OFFICIAL', 'MEDIA', 'COMMUNITY');--> statement-breakpoint
CREATE TYPE "public"."singing_status" AS ENUM('CAN_SING', 'REGULARLY_SING', 'PRACTICING', 'WANT_TO_LEARN');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('DEMO', 'VERIFIED', 'UNVERIFIED');--> statement-breakpoint
CREATE TABLE "ranking_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ranking_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"source_timestamp_seconds" integer,
	"verification_status" "verification_status" DEFAULT 'DEMO' NOT NULL,
	CONSTRAINT "ranking_entries_rank_positive" CHECK ("ranking_entries"."rank" > 0)
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"era" text,
	"source_type" "ranking_source_type" NOT NULL,
	"source_url" text,
	"description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "singing_list_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"status" "singing_status" DEFAULT 'WANT_TO_LEARN' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"artist" text NOT NULL,
	"release_year" integer,
	"verification_status" "verification_status" DEFAULT 'DEMO' NOT NULL,
	"normalized_title" text NOT NULL,
	"normalized_artist" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_top_list_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_top_list_entries_position_range" CHECK ("user_top_list_entries"."position" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_ranking_id_rankings_id_fk" FOREIGN KEY ("ranking_id") REFERENCES "public"."rankings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ranking_entries" ADD CONSTRAINT "ranking_entries_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "singing_list_entries" ADD CONSTRAINT "singing_list_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "singing_list_entries" ADD CONSTRAINT "singing_list_entries_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_top_list_entries" ADD CONSTRAINT "user_top_list_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_top_list_entries" ADD CONSTRAINT "user_top_list_entries_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_entries_ranking_rank_unique" ON "ranking_entries" USING btree ("ranking_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_entries_ranking_song_unique" ON "ranking_entries" USING btree ("ranking_id","song_id");--> statement-breakpoint
CREATE UNIQUE INDEX "singing_list_entries_user_song_unique" ON "singing_list_entries" USING btree ("user_id","song_id");--> statement-breakpoint
CREATE UNIQUE INDEX "songs_normalized_title_artist_unique" ON "songs" USING btree ("normalized_title","normalized_artist");--> statement-breakpoint
CREATE UNIQUE INDEX "user_top_list_entries_user_song_unique" ON "user_top_list_entries" USING btree ("user_id","song_id");--> statement-breakpoint
ALTER TABLE "user_top_list_entries" ADD CONSTRAINT "user_top_list_entries_user_position_unique" UNIQUE ("user_id", "position") DEFERRABLE INITIALLY DEFERRED;
