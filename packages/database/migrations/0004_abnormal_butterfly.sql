ALTER TABLE "songs" ADD COLUMN "submitted_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "songs_submitted_by_user_id_index" ON "songs" USING btree ("submitted_by_user_id");