# MediaWiki Parity Checklist

This document captures how the Next.js wiki platform aligns with the upstream MediaWiki data model and storage conventions. Use it as a reference when validating migrations or when importing data from an existing MediaWiki instance.

## Database Alignment

| MediaWiki Table | Platform Model | Notes |
| --- | --- | --- |
| `page` | `Page` | Adds `page_random`, `page_len`, `page_touched`, `links_updated`, `content_model`, and `page_lang` to mirror MediaWiki metadata. `page_is_new` is tracked via `isNew`. |
| `revision` | `Revision` | Stores parent pointers, SHA-1 hashes, byte lengths, content model/format, and comment references to match MediaWiki's revision metadata. |
| `comment` | `Comment` | New table to store revision and media comments using MediaWiki's hash-based deduplication. |
| `text` | `TextContent` | Supports MediaWiki-style compression flags for future parity with `old_flags`. |
| `image` | `Media` | Tracks uploader name, current version, SHA-1, MIME metadata, and description comment references similar to `img_user_text`, `img_sha1`, and `img_description`. |
| `oldimage` | `MediaArchive` | Already present; stores historic media versions with actor references. |
| `categorylinks` | `PageCategory` | Maintains sort keys and MediaWiki-style prefix field. |
| `pagelinks` | `PageLink` | Records from/to relationships for backlinks. |

Additional indexes (`page_random`, `rev_sha1`, `uploaded_by_name`) match the MediaWiki schema so that operations such as `Special:Random`, revision deduplication, and user-specific media queries behave similarly.

## Backend Behavior

* Page creation and edits now generate MediaWiki-compatible comment rows, SHA-1 hashes, byte lengths, and parent revision pointers.
* Page metadata updates keep `page_len`, `page_touched`, and `links_updated` synchronized with the latest revision, preserving expectations from maintenance scripts like `refreshLinks.php`.
* Revision summaries are deduplicated via the `Comment` table exactly like MediaWiki, enabling clean imports from dumps that reference comment IDs.
* Media revision updates run through the same TextContent/Comment flows so automated maintenance retains provenance and hashing metadata.

## File Storage Parity

* File uploads compute MediaWiki hash paths (`lib/storage/hash-path.ts`), populate SHA-1, MIME, and media type columns, and maintain `img_user_text` equivalents via `uploadedByName`.
* Descriptions are normalized into the shared `Comment` table, matching the `img_description` / `comment` linkage in MediaWiki core.
* Version counters increment on every upload (local or S3) to track the active version like MediaWiki's `img_major_mime`/`img_minor_mime` tables.
* Archived versions retain metadata, uploader attribution, and SHA-1 to stay consistent with MediaWiki's `oldimage` records.

## Operational Guidance

1. Run `npx prisma generate` followed by your preferred migration command (`prisma migrate deploy` or `db push`) to apply the new schema changes.
2. If importing MediaWiki dumps, map `page`, `revision`, `text`, and `comment` tables directly to the Prisma models described above. SHA-1, lengths, and comment hashes are stored verbatim.
3. Ensure any upload pipeline passes through `lib/storage/index.ts` so uploader names, comments, and version counters stay synchronized.

Keeping these components aligned ensures we can round-trip MediaWiki exports/imports and use familiar maintenance workflows without additional glue code.
