/**
 * Media version update utilities
 * Handles automatic updates when media files get new versions
 */

import crypto from 'crypto'

import { prisma } from './db'
import { splitMimeType, getMediaType } from './storage/hash-path'

/**
 * Update all page content that references a media file to use the latest version
 */
export async function updateMediaReferencesInPages(mediaId: string): Promise<void> {
  console.log(`🔄 Updating media references for media ID: ${mediaId}`)
  
  // Get the media file with its latest version info
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: {
      revisions: {
        orderBy: { versionNumber: 'desc' },
        take: 1,
      },
    },
  })

  if (!media) {
    console.log(`⚠️  Media not found: ${mediaId}`)
    return
  }

  // Get all pages that use this media file
  const pagesWithMedia = await prisma.page.findMany({
    where: {
      mediaUsages: {
        some: {
          mediaId: mediaId,
        },
      },
    },
    include: {
      revisions: {
        orderBy: { revisionNumber: 'desc' },
        take: 1,
        include: {
          textContent: true,
        },
      },
    },
  })

  console.log(`📄 Found ${pagesWithMedia.length} pages using this media file`)

  // Update each page's latest revision content
  for (const page of pagesWithMedia) {
    const latestRevision = page.revisions[0]
    if (!latestRevision) {
      console.log(`⚠️  No revision found for page ${page.slug}`)
      continue
    }

    // Update the content to use the latest media version
    const latestContent = latestRevision.textContent?.content || ''
    const updatedContent = updateImageReferencesInContent(
      latestContent,
      media.filename,
      media.url || ''
    )

    // Only update if content actually changed
    if (updatedContent !== latestContent) {
      console.log(`✏️  Updating content for page: ${page.slug}`)
      
      // Create a new revision with updated content
      const systemActor = await prisma.actor.upsert({
        where: { name: 'system' },
        update: {},
        create: {
          name: 'system',
          userId: null,
        },
      })

      const sha1 = crypto.createHash('sha1').update(updatedContent).digest('hex')
      let textContent = await prisma.textContent.findUnique({
        where: { sha1 },
      })

      if (!textContent) {
        textContent = await prisma.textContent.create({
          data: {
            content: updatedContent,
            sha1,
            byteSize: Buffer.byteLength(updatedContent, 'utf8'),
          },
        })
      }

      const commentText = `Updated image references to latest version of ${media.filename}`
      const commentHash = crypto.createHash('sha1').update(commentText).digest('hex')
      const comment = await prisma.comment.upsert({
        where: { hash: commentHash },
        create: {
          text: commentText,
          hash: commentHash,
        },
        update: {},
      })

      const newRevision = await prisma.revision.create({
        data: {
          pageId: page.id,
          textId: textContent.id,
          actorId: systemActor.id,
          summary: commentText,
          revisionNumber: latestRevision.revisionNumber + 1,
          timestamp: new Date(),
          isMinor: false,
          parentRevisionId: latestRevision.id,
          commentId: comment.id,
          byteSize: textContent.byteSize,
          sha1,
        },
      })

      // Update the page to point to the new revision
      await prisma.page.update({
        where: { id: page.id },
        data: {
          latestRevisionId: newRevision.id,
          updatedAt: new Date(),
          length: textContent.byteSize,
          linksUpdated: new Date(),
          isNew: false,
        },
      })

      console.log(`✅ Updated page ${page.slug} to revision ${newRevision.revisionNumber}`)
    } else {
      console.log(`ℹ️  No changes needed for page: ${page.slug}`)
    }
  }

  console.log(`🎉 Finished updating media references for ${media.filename}`)
}

/**
 * Update image references in content to use the latest version
 */
function updateImageReferencesInContent(content: string, filename: string, latestUrl: string): string {
  // Pattern to match markdown image syntax: ![alt](url)
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g
  
  return content.replace(imagePattern, (match, alt, url) => {
    // Check if this URL references our media file
    if (isMediaFileReference(url, filename)) {
      // Replace with the latest URL
      return `![${alt}](${latestUrl})`
    }
    return match
  })
}

/**
 * Check if a URL references a specific media file
 */
function isMediaFileReference(url: string, filename: string): boolean {
  // Handle different URL formats:
  // 1. Direct filename: "wiki-logo.svg"
  // 2. File page URL: "/file/wiki-logo.svg"
  // 3. Full URL: "https://example.com/wiki-logo.svg"
  // 4. Versioned URLs: "/wiki-logo-v2.svg", "/wiki-logo-v3.svg", etc.
  
  try {
    const urlObj = new URL(url, 'http://localhost')
    const pathname = urlObj.pathname
    
    // Check if it's a file page reference
    if (pathname.startsWith('/file/')) {
      const fileFromPath = decodeURIComponent(pathname.replace('/file/', ''))
      return fileFromPath === filename
    }
    
    // Check if it's a direct filename reference (including versioned files)
    if (pathname.includes(filename)) {
      return true
    }
    
    // Check if the URL ends with the filename
    return url.endsWith(filename) || url.includes(`/${filename}`)
  } catch {
    // If URL parsing fails, do simple string matching
    // This handles cases like "wiki-logo.svg", "wiki-logo-v2.svg", etc.
    return url.includes(filename)
  }
}

/**
 * Update media file to latest version and trigger content updates
 */
export async function updateMediaToLatestVersion(mediaId: string, newVersionData: {
  storageKey: string
  url: string
  byteSize: number
  width?: number
  height?: number
  contentType: string
  versionNumber: number
  uploadedById: string
  comment?: string
  sha1?: string
}): Promise<void> {
  console.log(`🔄 Updating media ${mediaId} to version ${newVersionData.versionNumber}`)
  
  // Create new media revision
  const [majorMime, minorMime] = splitMimeType(newVersionData.contentType)
  const mediaType = getMediaType(newVersionData.contentType)

  const newRevision = await prisma.mediaRevision.create({
    data: {
      mediaId,
      storageKey: newVersionData.storageKey,
      url: newVersionData.url,
      byteSize: newVersionData.byteSize,
      width: newVersionData.width,
      height: newVersionData.height,
      versionNumber: newVersionData.versionNumber,
      uploadedById: newVersionData.uploadedById,
      comment: newVersionData.comment,
    },
  })

  // Update the main media record to point to the new version
  const uploader = await prisma.user.findUnique({
    where: { id: newVersionData.uploadedById },
  })

  await prisma.media.update({
    where: { id: mediaId },
    data: {
      storageKey: newVersionData.storageKey,
      url: newVersionData.url,
      byteSize: newVersionData.byteSize,
      width: newVersionData.width,
      height: newVersionData.height,
      majorMime,
      minorMime,
      mediaType,
      currentVersion: newVersionData.versionNumber,
      sha1: newVersionData.sha1 ?? undefined,
      uploadedById: newVersionData.uploadedById,
      uploadedByName: uploader?.displayName || uploader?.username || null,
    },
  })

  console.log(`✅ Created new media revision: ${newRevision.id}`)

  // Update all page content that references this media file
  await updateMediaReferencesInPages(mediaId)
}

/**
 * Get the latest URL for a media file by filename
 */
export async function getLatestMediaUrl(filename: string): Promise<string | null> {
  const media = await prisma.media.findUnique({
    where: { filename },
  })

  return media?.url || null
}
