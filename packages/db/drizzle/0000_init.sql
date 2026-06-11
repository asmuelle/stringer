CREATE TYPE "public"."source_health" AS ENUM('ok', 'degraded', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('rss', 'edgar', 'federal_register', 'eurlex', 'govinfo', 'court', 'transcript', 'youtube', 'byo_x');--> statement-breakpoint
CREATE TABLE "beat" (
	"id" text PRIMARY KEY NOT NULL,
	"operator_id" text NOT NULL,
	"name" text NOT NULL,
	"t_dup" real NOT NULL,
	"t_novel" real NOT NULL,
	"nightly_budget_usd" real NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operator" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"plan_tier" text DEFAULT 'trial' NOT NULL,
	"monthly_cost_budget_usd" real DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" text PRIMARY KEY NOT NULL,
	"beat_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "source_kind" NOT NULL,
	"url" text NOT NULL,
	"poll_cadence_minutes" integer DEFAULT 60 NOT NULL,
	"health" "source_health" DEFAULT 'ok' NOT NULL,
	"last_content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "beat" ADD CONSTRAINT "beat_operator_id_operator_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."operator"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_beat_id_beat_id_fk" FOREIGN KEY ("beat_id") REFERENCES "public"."beat"("id") ON DELETE no action ON UPDATE no action;