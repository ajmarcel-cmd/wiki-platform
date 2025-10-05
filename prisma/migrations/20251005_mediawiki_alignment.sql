-- MediaWiki Schema Alignment Migration

-- 1. Add actor system
CREATE TABLE "Actor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "Actor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Actor_name_key" UNIQUE ("name")
);

CREATE INDEX "Actor_userId_idx" ON "Actor"("userId");
CREATE INDEX "Actor_name_idx" ON "Actor"("name");

-- 2. Add text storage table for better content handling
CREATE TABLE "TextContent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "content" TEXT NOT NULL,
  "sha1" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  
  CONSTRAINT "TextContent_sha1_key" UNIQUE ("sha1")
);

CREATE INDEX "TextContent_sha1_idx" ON "TextContent"("sha1");

-- 3. Update Revision table to use text storage and actor system
ALTER TABLE "Revision" ADD COLUMN "textId" TEXT;
ALTER TABLE "Revision" ADD COLUMN "actorId" TEXT;
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_textId_fkey" 
  FOREIGN KEY ("textId") REFERENCES "TextContent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Update Category system to match MediaWiki's simpler structure
ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_parentId_fkey";
ALTER TABLE "Category" DROP COLUMN "parentId";

-- 5. Add MediaWiki-style category sorting
ALTER TABLE "PageCategory" ADD COLUMN "sortKeyPrefix" TEXT;
CREATE INDEX "PageCategory_sortKeyPrefix_idx" ON "PageCategory"("sortKeyPrefix");

-- 6. Add MediaWiki-style page restrictions
CREATE TABLE "PageRestriction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pageId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "expiry" TIMESTAMP(3),
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "PageRestriction_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PageRestriction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PageRestriction_pageId_idx" ON "PageRestriction"("pageId");
CREATE INDEX "PageRestriction_type_idx" ON "PageRestriction"("type");
CREATE INDEX "PageRestriction_expiry_idx" ON "PageRestriction"("expiry");

-- 7. Add MediaWiki-style page props
CREATE TABLE "PageProps" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "pageId" TEXT NOT NULL,
  "propName" TEXT NOT NULL,
  "propValue" TEXT,
  "sortKey" FLOAT,
  
  CONSTRAINT "PageProps_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PageProps_pageId_propName_key" UNIQUE ("pageId", "propName")
);

CREATE INDEX "PageProps_propName_sortKey_idx" ON "PageProps"("propName", "sortKey");

-- 8. Add MediaWiki-style recent changes
CREATE TABLE "RecentChange" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actorId" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "revisionId" TEXT,
  "type" TEXT NOT NULL,
  "oldRevisionId" TEXT,
  "oldLength" INTEGER,
  "newLength" INTEGER,
  "params" JSONB,
  
  CONSTRAINT "RecentChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Actor"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecentChange_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecentChange_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "Revision"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "RecentChange_timestamp_idx" ON "RecentChange"("timestamp");
CREATE INDEX "RecentChange_actorId_idx" ON "RecentChange"("actorId");
CREATE INDEX "RecentChange_pageId_idx" ON "RecentChange"("pageId");
CREATE INDEX "RecentChange_type_idx" ON "RecentChange"("type");
