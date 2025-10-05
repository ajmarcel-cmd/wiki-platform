-- MediaWiki Parity Alignment

-- 1. Extend Page table with MediaWiki-compatible metadata
ALTER TABLE "Page"
  ADD COLUMN IF NOT EXISTS "is_new" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "page_random" DOUBLE PRECISION NOT NULL DEFAULT random(),
  ADD COLUMN IF NOT EXISTS "page_touched" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "links_updated" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "page_len" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "content_model" TEXT NOT NULL DEFAULT 'wikitext',
  ADD COLUMN IF NOT EXISTS "page_lang" TEXT;

CREATE INDEX IF NOT EXISTS "Page_page_random_idx" ON "Page"("page_random");

-- 2. Extend TextContent table to capture compression flags
ALTER TABLE "TextContent"
  ADD COLUMN IF NOT EXISTS "compression" TEXT;

-- 3. Add Comment table (MediaWiki-style comment storage)
CREATE TABLE IF NOT EXISTS "Comment" (
  "id" TEXT PRIMARY KEY,
  "text" TEXT NOT NULL,
  "data" JSONB,
  "hash" TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS "Comment_hash_idx" ON "Comment"("hash");

-- 4. Update Revision table with MediaWiki metadata
ALTER TABLE "Revision"
  ADD COLUMN IF NOT EXISTS "parentRevisionId" TEXT,
  ADD COLUMN IF NOT EXISTS "commentId" TEXT,
  ADD COLUMN IF NOT EXISTS "rev_len" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rev_sha1" TEXT,
  ADD COLUMN IF NOT EXISTS "rev_deleted" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "content_model" TEXT NOT NULL DEFAULT 'wikitext',
  ADD COLUMN IF NOT EXISTS "content_format" TEXT NOT NULL DEFAULT 'text/x-wiki';

ALTER TABLE "Revision"
  ADD CONSTRAINT IF NOT EXISTS "Revision_parentRevisionId_fkey"
    FOREIGN KEY ("parentRevisionId") REFERENCES "Revision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Revision"
  ADD CONSTRAINT IF NOT EXISTS "Revision_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Revision_rev_sha1_idx" ON "Revision"("rev_sha1");

-- 5. Update Media table with additional MediaWiki fields
ALTER TABLE "Media"
  ADD COLUMN IF NOT EXISTS "uploaded_by_name" TEXT,
  ADD COLUMN IF NOT EXISTS "current_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "description_id" TEXT;

ALTER TABLE "Media"
  ADD CONSTRAINT IF NOT EXISTS "Media_description_id_fkey"
    FOREIGN KEY ("description_id") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ensure supporting indexes exist
CREATE INDEX IF NOT EXISTS "Media_uploaded_by_name_idx" ON "Media"("uploaded_by_name");
