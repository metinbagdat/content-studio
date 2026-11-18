-- Content Studio uses Prisma via DATABASE_URL (service role / direct Postgres).
-- Enable RLS with NO policies for anon/authenticated so PostgREST public API cannot
-- read/write tables. service_role and postgres bypass RLS.
-- Local Docker has no anon/authenticated roles — REVOKE is gated.

ALTER TABLE "ContentSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DerivedContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentPipeline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialMediaAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialMediaPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QueueJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewBulkJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOREACH t IN ARRAY ARRAY[
      'ContentSource', 'DerivedContent', 'MediaFile', 'ContentPipeline',
      'SocialMediaAccount', 'SocialMediaPost', 'QueueJob', 'ReviewBulkJob',
      '_prisma_migrations'
    ]
    LOOP
      EXECUTE format('REVOKE ALL ON TABLE %I FROM anon', t);
    END LOOP;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOREACH t IN ARRAY ARRAY[
      'ContentSource', 'DerivedContent', 'MediaFile', 'ContentPipeline',
      'SocialMediaAccount', 'SocialMediaPost', 'QueueJob', 'ReviewBulkJob',
      '_prisma_migrations'
    ]
    LOOP
      EXECUTE format('REVOKE ALL ON TABLE %I FROM authenticated', t);
    END LOOP;
  END IF;
END $$;
