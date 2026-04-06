create extension if not exists "pg_cron" with schema "pg_catalog";

create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";

create type "public"."news_category" as enum ('top', 'world', 'business', 'finance', 'tech', 'sports', 'lifestyle', 'politics', 'other');

create type "public"."news_region" as enum ('china', 'us', 'asia', 'europe', 'middle_east', 'global', 'other');


  create table "public"."email_logs" (
    "id" uuid not null default gen_random_uuid(),
    "subscriber_id" uuid not null,
    "digest_id" uuid not null,
    "sent_at" timestamp without time zone not null default (now() AT TIME ZONE 'utc'::text),
    "status" text not null,
    "provider" text,
    "provider_msg_id" text,
    "error_msg" text
      );


alter table "public"."email_logs" enable row level security;


  create table "public"."google_news_rss_archive" (
    "id" uuid,
    "topic" text,
    "language" text,
    "title" text,
    "source" text,
    "pub_date" timestamp with time zone,
    "guid" text,
    "link" text,
    "description" text,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "importance_score" integer,
    "importance_scored_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "archive_reason" text,
    "archive_run_id" uuid
      );


alter table "public"."google_news_rss_archive" enable row level security;


  create table "public"."news_items_en" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "created_at" timestamp without time zone not null default (now() AT TIME ZONE 'utc'::text),
    "source" text,
    "category" text,
    "guid" text not null,
    "google_link" text,
    "pub_date" timestamp without time zone,
    "google_rss_description" text
      );


alter table "public"."news_items_en" enable row level security;


  create table "public"."news_items_zh" (
    "id" uuid not null default gen_random_uuid(),
    "category" text,
    "title" text not null,
    "source" text,
    "created_at" timestamp without time zone not null default (now() AT TIME ZONE 'utc'::text),
    "guid" text not null,
    "google_link" text,
    "pub_date" timestamp without time zone,
    "google_rss_description" text
      );


alter table "public"."news_items_zh" enable row level security;


  create table "public"."subscribers" (
    "id" uuid not null default gen_random_uuid(),
    "email" text not null,
    "is_active" boolean not null default true,
    "created_at" timestamp without time zone not null default (now() AT TIME ZONE 'utc'::text),
    "unsubscribed_at" timestamp without time zone,
    "preferred_regions" public.news_region[] not null default '{}'::public.news_region[],
    "preferred_categories" public.news_category[] not null default '{}'::public.news_category[]
      );


alter table "public"."subscribers" enable row level security;

alter table "public"."google_news_rss" drop column "published_at";

alter table "public"."google_news_rss" add column "importance_scored_at" timestamp with time zone;

alter table "public"."google_news_rss" alter column "importance_score" set data type integer using "importance_score"::integer;

alter table "public"."google_news_rss" alter column "pub_date" set not null;

alter table "public"."google_news_rss" alter column "pub_date" set data type timestamp with time zone using "pub_date"::timestamp with time zone;

alter table "public"."google_news_rss" alter column "source" drop default;

alter table "public"."google_news_rss" alter column "updated_at" drop not null;

alter table "public"."google_news_rss" enable row level security;

alter table "public"."rss_fetch_schedule" enable row level security;

CREATE INDEX email_logs_digest_id_idx ON public.email_logs USING btree (digest_id);

CREATE UNIQUE INDEX email_logs_pkey ON public.email_logs USING btree (id);

CREATE INDEX email_logs_sent_at_idx ON public.email_logs USING btree (sent_at);

CREATE INDEX email_logs_subscriber_id_idx ON public.email_logs USING btree (subscriber_id);

CREATE UNIQUE INDEX google_news_rss_archive_id_uidx ON public.google_news_rss_archive USING btree (id);

CREATE INDEX google_news_rss_archive_run_id_idx ON public.google_news_rss_archive USING btree (archive_run_id);

CREATE INDEX idx_google_news_rss_lang_pub_date_score ON public.google_news_rss USING btree (language, pub_date DESC, importance_score DESC);

CREATE INDEX idx_google_news_rss_pub_date ON public.google_news_rss USING btree (pub_date DESC);

CREATE INDEX idx_google_news_rss_source ON public.google_news_rss USING btree (source);

CREATE INDEX news_items_en_category_idx ON public.news_items_en USING btree (category);

CREATE INDEX news_items_en_pub_date_idx ON public.news_items_en USING btree (pub_date);

CREATE UNIQUE INDEX news_items_en_title_key ON public.news_items_en USING btree (title);

CREATE UNIQUE INDEX news_items_pkey ON public.news_items_en USING btree (id);

CREATE INDEX news_items_zh_category_idx ON public.news_items_zh USING btree (category);

CREATE UNIQUE INDEX news_items_zh_pkey ON public.news_items_zh USING btree (id);

CREATE INDEX news_items_zh_pub_date_idx ON public.news_items_zh USING btree (pub_date);

CREATE UNIQUE INDEX news_items_zh_title_key ON public.news_items_zh USING btree (title);

CREATE UNIQUE INDEX subscribers_email_key ON public.subscribers USING btree (email);

CREATE UNIQUE INDEX subscribers_pkey ON public.subscribers USING btree (id);

alter table "public"."email_logs" add constraint "email_logs_pkey" PRIMARY KEY using index "email_logs_pkey";

alter table "public"."news_items_en" add constraint "news_items_pkey" PRIMARY KEY using index "news_items_pkey";

alter table "public"."news_items_zh" add constraint "news_items_zh_pkey" PRIMARY KEY using index "news_items_zh_pkey";

alter table "public"."subscribers" add constraint "subscribers_pkey" PRIMARY KEY using index "subscribers_pkey";

alter table "public"."email_logs" add constraint "email_logs_subscriber_id_fkey" FOREIGN KEY (subscriber_id) REFERENCES public.subscribers(id) ON DELETE CASCADE not valid;

alter table "public"."email_logs" validate constraint "email_logs_subscriber_id_fkey";

alter table "public"."news_items_en" add constraint "news_items_en_title_key" UNIQUE using index "news_items_en_title_key";

alter table "public"."news_items_zh" add constraint "news_items_zh_title_key" UNIQUE using index "news_items_zh_title_key";

alter table "public"."subscribers" add constraint "subscribers_email_key" UNIQUE using index "subscribers_email_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.cleanup_google_news_rss_duplicates()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_run_id uuid := gen_random_uuid();
  v_archived_count integer := 0;
  v_deleted_count integer := 0;
BEGIN
  WITH ranked AS (
    SELECT
      g.id,
      row_number() OVER (
        PARTITION BY g.title
        ORDER BY g.pub_date ASC NULLS LAST, g.created_at ASC, g.id ASC
      ) AS rn
    FROM public.google_news_rss g
    WHERE g.created_at >= now() - interval '14 days'
  ),
  to_archive AS (
    SELECT g.*
    FROM public.google_news_rss g
    JOIN ranked r ON r.id = g.id
    WHERE r.rn > 1
  ),
  archived AS (
    INSERT INTO public.google_news_rss_archive (
      pub_date,
      id,
      topic,
      language,
      title,
      source,
      guid,
      link,
      description,
      created_at,
      updated_at,
      importance_score,
      importance_scored_at,
      archived_at,
      archive_reason,
      archive_run_id
    )
    SELECT
      ta.pub_date,
      ta.id,
      ta.topic,
      ta.language,
      ta.title,
      ta.source,
      ta.guid,
      ta.link,
      ta.description,
      ta.created_at,
      ta.updated_at,
      ta.importance_score,
      ta.importance_scored_at,
      now(),
      'newer_duplicate_by_title_keep_oldest_pub_date',
      v_run_id
    FROM to_archive ta
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  ),
  deleted AS (
    DELETE FROM public.google_news_rss g
    USING to_archive ta
    WHERE g.id = ta.id
    RETURNING g.id
  )
  SELECT
    (SELECT count(*)::int FROM archived),
    (SELECT count(*)::int FROM deleted)
  INTO v_archived_count, v_deleted_count;

  RETURN jsonb_build_object(
    'mode', 'archive_then_delete',
    'days_back', 14,
    'archive_run_id', v_run_id,
    'archived_count', v_archived_count,
    'deleted_count', v_deleted_count
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."email_logs" to "anon";

grant insert on table "public"."email_logs" to "anon";

grant references on table "public"."email_logs" to "anon";

grant select on table "public"."email_logs" to "anon";

grant trigger on table "public"."email_logs" to "anon";

grant truncate on table "public"."email_logs" to "anon";

grant update on table "public"."email_logs" to "anon";

grant delete on table "public"."email_logs" to "authenticated";

grant insert on table "public"."email_logs" to "authenticated";

grant references on table "public"."email_logs" to "authenticated";

grant select on table "public"."email_logs" to "authenticated";

grant trigger on table "public"."email_logs" to "authenticated";

grant truncate on table "public"."email_logs" to "authenticated";

grant update on table "public"."email_logs" to "authenticated";

grant delete on table "public"."email_logs" to "service_role";

grant insert on table "public"."email_logs" to "service_role";

grant references on table "public"."email_logs" to "service_role";

grant select on table "public"."email_logs" to "service_role";

grant trigger on table "public"."email_logs" to "service_role";

grant truncate on table "public"."email_logs" to "service_role";

grant update on table "public"."email_logs" to "service_role";

grant delete on table "public"."google_news_rss_archive" to "anon";

grant insert on table "public"."google_news_rss_archive" to "anon";

grant references on table "public"."google_news_rss_archive" to "anon";

grant select on table "public"."google_news_rss_archive" to "anon";

grant trigger on table "public"."google_news_rss_archive" to "anon";

grant truncate on table "public"."google_news_rss_archive" to "anon";

grant update on table "public"."google_news_rss_archive" to "anon";

grant delete on table "public"."google_news_rss_archive" to "authenticated";

grant insert on table "public"."google_news_rss_archive" to "authenticated";

grant references on table "public"."google_news_rss_archive" to "authenticated";

grant select on table "public"."google_news_rss_archive" to "authenticated";

grant trigger on table "public"."google_news_rss_archive" to "authenticated";

grant truncate on table "public"."google_news_rss_archive" to "authenticated";

grant update on table "public"."google_news_rss_archive" to "authenticated";

grant delete on table "public"."google_news_rss_archive" to "service_role";

grant insert on table "public"."google_news_rss_archive" to "service_role";

grant references on table "public"."google_news_rss_archive" to "service_role";

grant select on table "public"."google_news_rss_archive" to "service_role";

grant trigger on table "public"."google_news_rss_archive" to "service_role";

grant truncate on table "public"."google_news_rss_archive" to "service_role";

grant update on table "public"."google_news_rss_archive" to "service_role";

grant delete on table "public"."news_items_en" to "anon";

grant insert on table "public"."news_items_en" to "anon";

grant references on table "public"."news_items_en" to "anon";

grant select on table "public"."news_items_en" to "anon";

grant trigger on table "public"."news_items_en" to "anon";

grant truncate on table "public"."news_items_en" to "anon";

grant update on table "public"."news_items_en" to "anon";

grant delete on table "public"."news_items_en" to "authenticated";

grant insert on table "public"."news_items_en" to "authenticated";

grant references on table "public"."news_items_en" to "authenticated";

grant select on table "public"."news_items_en" to "authenticated";

grant trigger on table "public"."news_items_en" to "authenticated";

grant truncate on table "public"."news_items_en" to "authenticated";

grant update on table "public"."news_items_en" to "authenticated";

grant delete on table "public"."news_items_en" to "service_role";

grant insert on table "public"."news_items_en" to "service_role";

grant references on table "public"."news_items_en" to "service_role";

grant select on table "public"."news_items_en" to "service_role";

grant trigger on table "public"."news_items_en" to "service_role";

grant truncate on table "public"."news_items_en" to "service_role";

grant update on table "public"."news_items_en" to "service_role";

grant delete on table "public"."news_items_zh" to "anon";

grant insert on table "public"."news_items_zh" to "anon";

grant references on table "public"."news_items_zh" to "anon";

grant select on table "public"."news_items_zh" to "anon";

grant trigger on table "public"."news_items_zh" to "anon";

grant truncate on table "public"."news_items_zh" to "anon";

grant update on table "public"."news_items_zh" to "anon";

grant delete on table "public"."news_items_zh" to "authenticated";

grant insert on table "public"."news_items_zh" to "authenticated";

grant references on table "public"."news_items_zh" to "authenticated";

grant select on table "public"."news_items_zh" to "authenticated";

grant trigger on table "public"."news_items_zh" to "authenticated";

grant truncate on table "public"."news_items_zh" to "authenticated";

grant update on table "public"."news_items_zh" to "authenticated";

grant delete on table "public"."news_items_zh" to "service_role";

grant insert on table "public"."news_items_zh" to "service_role";

grant references on table "public"."news_items_zh" to "service_role";

grant select on table "public"."news_items_zh" to "service_role";

grant trigger on table "public"."news_items_zh" to "service_role";

grant truncate on table "public"."news_items_zh" to "service_role";

grant update on table "public"."news_items_zh" to "service_role";

grant delete on table "public"."subscribers" to "anon";

grant insert on table "public"."subscribers" to "anon";

grant references on table "public"."subscribers" to "anon";

grant select on table "public"."subscribers" to "anon";

grant trigger on table "public"."subscribers" to "anon";

grant truncate on table "public"."subscribers" to "anon";

grant update on table "public"."subscribers" to "anon";

grant delete on table "public"."subscribers" to "authenticated";

grant insert on table "public"."subscribers" to "authenticated";

grant references on table "public"."subscribers" to "authenticated";

grant select on table "public"."subscribers" to "authenticated";

grant trigger on table "public"."subscribers" to "authenticated";

grant truncate on table "public"."subscribers" to "authenticated";

grant update on table "public"."subscribers" to "authenticated";

grant delete on table "public"."subscribers" to "service_role";

grant insert on table "public"."subscribers" to "service_role";

grant references on table "public"."subscribers" to "service_role";

grant select on table "public"."subscribers" to "service_role";

grant trigger on table "public"."subscribers" to "service_role";

grant truncate on table "public"."subscribers" to "service_role";

grant update on table "public"."subscribers" to "service_role";


  create policy "public_read_only_on_google_news_rss"
  on "public"."google_news_rss"
  as permissive
  for select
  to anon
using (true);



  create policy "public_read_only_on_news_items_en"
  on "public"."news_items_en"
  as permissive
  for select
  to anon
using (true);



  create policy "public_read_only_on_news_items_zh"
  on "public"."news_items_zh"
  as permissive
  for select
  to anon
using (true);


CREATE TRIGGER set_updated_at_trigger BEFORE INSERT OR UPDATE ON public.google_news_rss FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


