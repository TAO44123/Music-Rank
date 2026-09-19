CREATE TABLE "singing_list_entry_reactions" (
	"entry_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "singing_list_entry_reactions_entry_user_pk" PRIMARY KEY("entry_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "top_list_entry_reactions" (
	"entry_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "top_list_entry_reactions_entry_user_pk" PRIMARY KEY("entry_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "singing_list_entry_reactions" ADD CONSTRAINT "singing_list_entry_reactions_entry_id_singing_list_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."singing_list_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "singing_list_entry_reactions" ADD CONSTRAINT "singing_list_entry_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_list_entry_reactions" ADD CONSTRAINT "top_list_entry_reactions_entry_id_user_top_list_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."user_top_list_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_list_entry_reactions" ADD CONSTRAINT "top_list_entry_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "singing_list_entry_reactions_user_id_index" ON "singing_list_entry_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "top_list_entry_reactions_user_id_index" ON "top_list_entry_reactions" USING btree ("user_id");