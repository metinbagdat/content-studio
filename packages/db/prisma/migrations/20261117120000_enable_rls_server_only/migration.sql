-- Content Studio uses Prisma via DATABASE_URL (service role / direct Postgres).
-- Enable RLS with NO policies for anon/authenticated so PostgREST public API cannot
-- read/write tables. service_role and postgres bypass RLS.

ALTER TABLE "ContentSource" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DerivedContent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaFile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContentPipeline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialMediaAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialMediaPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QueueJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewBulkJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- Defense in depth: revoke direct grants from anon/authenticated if present.
REVOKE ALL ON TABLE "ContentSource" FROM anon, authenticated;
REVOKE ALL ON TABLE "DerivedContent" FROM anon, authenticated;
REVOKE ALL ON TABLE "MediaFile" FROM anon, authenticated;
REVOKE ALL ON TABLE "ContentPipeline" FROM anon, authenticated;
REVOKE ALL ON TABLE "SocialMediaAccount" FROM anon, authenticated;
REVOKE ALL ON TABLE "SocialMediaPost" FROM anon, authenticated;
REVOKE ALL ON TABLE "QueueJob" FROM anon, authenticated;
REVOKE ALL ON TABLE "ReviewBulkJob" FROM anon, authenticated;
REVOKE ALL ON TABLE "_prisma_migrations" FROM anon, authenticated;
