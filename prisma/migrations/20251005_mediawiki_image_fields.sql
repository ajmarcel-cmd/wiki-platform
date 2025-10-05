-- MediaWiki-compatible image fields
ALTER TABLE "Media" 
  -- Add MediaWiki-style fields
  ADD COLUMN "major_mime" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "minor_mime" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "img_metadata" JSONB,
  ADD COLUMN "sha1" TEXT,
  ADD COLUMN "bits" INTEGER,
  ADD COLUMN "media_type" TEXT,
  ADD COLUMN "archive_name" TEXT,
  ADD COLUMN "deleted" INTEGER DEFAULT 0,
  ADD COLUMN "description_id" TEXT,
  
  -- Add indexes
  ADD INDEX "media_sha1_idx" ("sha1"),
  ADD INDEX "media_timestamp_idx" ("uploadedAt"),
  ADD INDEX "media_media_type_idx" ("media_type"),
  ADD INDEX "media_major_mime_idx" ("major_mime");

-- Update existing mime type data
UPDATE "Media"
SET 
  major_mime = SPLIT_PART(mime_type, '/', 1),
  minor_mime = SPLIT_PART(mime_type, '/', 2)
WHERE mime_type IS NOT NULL;

-- Create media archive table for old versions
CREATE TABLE "MediaArchive" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "media_id" TEXT NOT NULL,
  "archive_name" TEXT NOT NULL,
  "deleted" INTEGER DEFAULT 0,
  "storage_key" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "bits" INTEGER,
  "metadata" JSONB,
  "major_mime" TEXT NOT NULL,
  "minor_mime" TEXT NOT NULL,
  "description" TEXT,
  "actor_id" TEXT,
  "timestamp" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sha1" TEXT,
  "media_type" TEXT,
  
  FOREIGN KEY ("media_id") REFERENCES "Media"("id") ON DELETE CASCADE,
  FOREIGN KEY ("actor_id") REFERENCES "Actor"("id") ON DELETE SET NULL
);

CREATE INDEX "media_archive_media_id_idx" ON "MediaArchive"("media_id");
CREATE INDEX "media_archive_sha1_idx" ON "MediaArchive"("sha1");
CREATE INDEX "media_archive_timestamp_idx" ON "MediaArchive"("timestamp");
CREATE INDEX "media_archive_actor_id_idx" ON "MediaArchive"("actor_id");

-- Drop old MediaRevision table as we'll use MediaArchive instead
DROP TABLE "MediaRevision";
