/**
 * Wiki data access layer
 * All database queries for wiki pages and related content
 */

import { prisma } from './db'
import { createCachedFunction, CacheTags, CacheDurations } from './cache'

export interface WikiPage {
  id: string
  slug: string
  title: string
  displayTitle: string
  content: string
  namespace: string
  categories: Array<{ name: string; slug: string }>
  updatedAt: Date
  viewCount: number
  isRedirect: boolean
  redirectTarget: string | null
}

export interface WikiPageListItem {
  slug: string
  title: string
  displayTitle: string
  namespace: string
  updatedAt: Date
  viewCount: number
}

/**
 * Get a page by its slug (uncached)
 */
async function _getPageBySlug(slug: string): Promise<WikiPage | null> {
  const page = await prisma.page.findUnique({
    where: { slug },
    include: {
      namespace: true,
      revisions: {
        orderBy: { revisionNumber: 'desc' },
        take: 1,
        include: {
          textContent: true,
        },
      },
      categories: {
        include: {
          category: true,
        },
      },
    },
  })

  if (!page || page.revisions.length === 0) {
    return null
  }

  const latestRevision = page.revisions[0]

  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    displayTitle: page.displayTitle,
    content: latestRevision.textContent.content,
    namespace: page.namespace.name,
    categories: page.categories.map((pc) => ({
      name: pc.category.displayName,
      slug: pc.category.slug,
    })),
    updatedAt: page.updatedAt,
    viewCount: page.viewCount,
    isRedirect: page.isRedirect,
    redirectTarget: page.redirectTarget,
  }
}

/**
 * Get a page by its slug (cached)
 */
export const getPageBySlug = createCachedFunction(
  _getPageBySlug,
  'page',
  {
    revalidate: CacheDurations.page,
    tags: ['pages'],
  }
)

/**
 * Get all pages (paginated, uncached)
 */
async function _getAllPages(
  page: number = 1,
  limit: number = 50
): Promise<{ pages: WikiPageListItem[]; total: number; hasMore: boolean }> {
  const skip = (page - 1) * limit

  const [pages, total] = await Promise.all([
    prisma.page.findMany({
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        namespace: true,
      },
    }),
    prisma.page.count(),
  ])

  return {
    pages: pages.map((p) => ({
      slug: p.slug,
      title: p.title,
      displayTitle: p.displayTitle,
      namespace: p.namespace.name,
      updatedAt: p.updatedAt,
      viewCount: p.viewCount,
    })),
    total,
    hasMore: skip + pages.length < total,
  }
}

/**
 * Get all pages (cached)
 */
export const getAllPages = createCachedFunction(
  _getAllPages,
  'pages-list',
  {
    revalidate: CacheDurations.list,
    tags: ['pages'],
  }
)

/**
 * Get recent pages (paginated, uncached)
 */
async function _getRecentPages(
  page: number = 1,
  limit: number = 50
): Promise<{ pages: WikiPageListItem[]; total: number; hasMore: boolean }> {
  const skip = (page - 1) * limit

  const [pages, total] = await Promise.all([
    prisma.page.findMany({
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        namespace: true,
      },
    }),
    prisma.page.count(),
  ])

  return {
    pages: pages.map((p) => ({
      slug: p.slug,
      title: p.title,
      displayTitle: p.displayTitle,
      namespace: p.namespace.name,
      updatedAt: p.updatedAt,
      viewCount: p.viewCount,
    })),
    total,
    hasMore: skip + pages.length < total,
  }
}

/**
 * Get recent pages (cached)
 */
export const getRecentPages = createCachedFunction(
  _getRecentPages,
  'recent-pages-list',
  {
    revalidate: CacheDurations.list,
    tags: ['pages'],
  }
)

/**
 * Search pages by title or content (uncached for now)
 */
export async function searchPages(query: string, limit: number = 20): Promise<WikiPageListItem[]> {
  if (!query.trim()) {
    return []
  }

  // Simple text search - can be enhanced with Postgres FTS or external search
  const pages = await prisma.page.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { displayTitle: { contains: query, mode: 'insensitive' } },
      ],
    },
    take: limit,
    include: {
      namespace: true,
    },
    orderBy: {
      viewCount: 'desc',
    },
  })

  return pages.map((p) => ({
    slug: p.slug,
    title: p.title,
    displayTitle: p.displayTitle,
    namespace: p.namespace.name,
    updatedAt: p.updatedAt,
    viewCount: p.viewCount,
  }))
}

/**
 * Get pages by category
 */
export async function getPagesByCategory(
  categorySlug: string,
  page: number = 1,
  limit: number = 50
): Promise<{ pages: WikiPageListItem[]; total: number; hasMore: boolean }> {
  const skip = (page - 1) * limit

  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
  })

  if (!category) {
    return { pages: [], total: 0, hasMore: false }
  }

  const [pageCategories, total] = await Promise.all([
    prisma.pageCategory.findMany({
      where: { categoryId: category.id },
      skip,
      take: limit,
      include: {
        page: {
          include: {
            namespace: true,
          },
        },
      },
      orderBy: {
        sortKey: 'asc',
      },
    }),
    prisma.pageCategory.count({
      where: { categoryId: category.id },
    }),
  ])

  return {
    pages: pageCategories.map((pc) => ({
      slug: pc.page.slug,
      title: pc.page.title,
      displayTitle: pc.page.displayTitle,
      namespace: pc.page.namespace.name,
      updatedAt: pc.page.updatedAt,
      viewCount: pc.page.viewCount,
    })),
    total,
    hasMore: skip + pageCategories.length < total,
  }
}

/**
 * Get all categories
 */
export async function getAllCategories() {
  return await prisma.category.findMany({
    include: {
      _count: {
        select: { 
          pages: true, 
          media: true 
        },
      },
    },
    orderBy: {
      displayName: 'asc',
    },
  })
}

/**
 * Get category by slug
 */
export async function getCategoryBySlug(slug: string) {
  return await prisma.category.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { pages: true, media: true },
      },
    },
  })
}

/**
 * Increment page view count
 */
export async function incrementPageViews(slug: string) {
  await prisma.page.update({
    where: { slug },
    data: {
      viewCount: {
        increment: 1,
      },
    },
  })
}

/**
 * Get page revision history
 */
export async function getPageRevisions(slug: string, limit: number = 50) {
  const page = await prisma.page.findUnique({
    where: { slug },
  })

  if (!page) {
    return []
  }

  return await prisma.revision.findMany({
    where: { pageId: page.id },
    orderBy: { revisionNumber: 'desc' },
    take: limit,
  })
}

/**
 * Get backlinks to a page
 */
export async function getBacklinks(slug: string) {
  const page = await prisma.page.findUnique({
    where: { slug },
  })

  if (!page) {
    return []
  }

  const links = await prisma.pageLink.findMany({
    where: { toPageId: page.id },
    include: {
      fromPage: {
        include: {
          namespace: true,
        },
      },
    },
  })

  return links.map((link) => ({
    slug: link.fromPage.slug,
    title: link.fromPage.displayTitle,
    namespace: link.fromPage.namespace.name,
    anchorText: link.anchorText,
  }))
}

/**
 * Get media files by category
 */
export async function getMediaByCategory(
  categorySlug: string,
  page: number = 1,
  limit: number = 50
): Promise<{ media: any[]; total: number; hasMore: boolean }> {
  const skip = (page - 1) * limit

  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
  })

  if (!category) {
    return { media: [], total: 0, hasMore: false }
  }

  const [mediaCategories, total] = await Promise.all([
    prisma.mediaCategory.findMany({
      where: { categoryId: category.id },
      skip,
      take: limit,
      include: {
        media: {
          include: {
            uploadedBy: true,
          },
        },
      },
      orderBy: {
        sortKey: 'asc',
      },
    }),
    prisma.mediaCategory.count({
      where: { categoryId: category.id },
    }),
  ])

  return {
    media: mediaCategories.map((mc) => mc.media),
    total,
    hasMore: skip + mediaCategories.length < total,
  }
}

/**
 * Add media to category
 */
export async function addMediaToCategory(mediaId: string, categoryId: string, sortKey?: string) {
  return await prisma.mediaCategory.create({
    data: {
      mediaId,
      categoryId,
      sortKey,
    },
  })
}

/**
 * Remove media from category
 */
export async function removeMediaFromCategory(mediaId: string, categoryId: string) {
  return await prisma.mediaCategory.delete({
    where: {
      mediaId_categoryId: {
        mediaId,
        categoryId,
      },
    },
  })
}

/**
 * Get media categories
 */
export async function getMediaCategories(mediaId: string) {
  const mediaCategories = await prisma.mediaCategory.findMany({
    where: { mediaId },
    include: {
      category: true,
    },
  })

  return mediaCategories.map((mc) => ({
    id: mc.category.id,
    name: mc.category.name,
    displayName: mc.category.displayName,
    slug: mc.category.slug,
    sortKey: mc.sortKey,
  }))
}

/**
 * Link categories to a page
 */
export async function linkCategoriesToPage(pageId: string, categoryNames: string[]) {
  for (const categoryName of categoryNames) {
    // Find or create category
    const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    
    let category = await prisma.category.findUnique({
      where: { slug }
    })
    
    if (!category) {
      category = await prisma.category.create({
        data: {
          name: categoryName,
          displayName: categoryName,
          slug
        }
      })
    }
    
    // Link page to category (ignore if already linked)
    try {
      await prisma.pageCategory.create({
        data: {
          pageId,
          categoryId: category.id,
          sortKey: categoryName
        }
      })
    } catch (error) {
      // Ignore duplicate key errors
      if (!error.message?.includes('Unique constraint')) {
        throw error
      }
    }
  }
}

/**
 * Create a new wiki page
 */
export async function createPage(options: {
  title: string
  content: string
  namespace?: string
  summary?: string
  actorId?: string
}): Promise<WikiPage> {
  const { title, content, namespace = 'Main', summary, actorId } = options
  
  // Get or create namespace
  let namespaceRecord = await prisma.namespace.findUnique({
    where: { name: namespace }
  })
  
  if (!namespaceRecord) {
    namespaceRecord = await prisma.namespace.create({
      data: {
        name: namespace,
        displayName: namespace,
        canonical: namespace === 'Main'
      }
    })
  }
  
  // Generate slug from title
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  
  // Check if page already exists
  const existingPage = await prisma.page.findUnique({
    where: { slug }
  })
  
  if (existingPage) {
    throw new Error(`Page with slug "${slug}" already exists`)
  }
  
  // Create or get actor
  let actor
  if (actorId) {
    actor = await prisma.actor.findUnique({
      where: { id: actorId }
    })
  }
  
  if (!actor) {
    // Try to find existing system actor first
    actor = await prisma.actor.findUnique({
      where: { name: 'system' }
    })
    
    if (!actor) {
      // Create anonymous actor
      actor = await prisma.actor.create({
        data: {
          name: 'system',
          userId: null
        }
      })
    }
  }
  
  // Create or find existing text content
  const crypto = require('crypto')
  const sha1 = crypto.createHash('sha1').update(content).digest('hex')
  
  let textContent = await prisma.textContent.findUnique({
    where: { sha1 }
  })
  
  if (!textContent) {
    textContent = await prisma.textContent.create({
      data: {
        content,
        sha1,
        byteSize: Buffer.byteLength(content, 'utf8')
      }
    })
  }
  
  // Create page
  const page = await prisma.page.create({
    data: {
      namespaceId: namespaceRecord.id,
      title,
      displayTitle: title,
      slug,
      latestRevisionId: null, // Will be set after creating revision
      isRedirect: false,
      redirectTarget: null,
      viewCount: 0
    }
  })
  
  // Create initial revision
  const revision = await prisma.revision.create({
    data: {
      pageId: page.id,
      textId: textContent.id,
      actorId: actor.id,
      summary: summary || 'Initial creation',
      revisionNumber: 1,
      timestamp: new Date(),
      isMinor: false
    }
  })
  
  // Update page with latest revision
  await prisma.page.update({
    where: { id: page.id },
    data: {
      latestRevisionId: revision.id
    }
  })
  
  // Create recent change entry
  await prisma.recentChange.create({
    data: {
      actorId: actor.id,
      pageId: page.id,
      revisionId: revision.id,
      type: 'new',
      newLength: textContent.byteSize
    }
  })
  
  // Extract and link categories
  const categoryRegex = /\[\[Category:([^\]]+)\]\]/gi
  const categories: string[] = []
  let match
  
  while ((match = categoryRegex.exec(content)) !== null) {
    categories.push(match[1].trim())
  }
  
  if (categories.length > 0) {
    await linkCategoriesToPage(page.id, categories)
  }
  
  // Return the created page
  return _getPageBySlug(slug)
}

/**
 * Update an existing wiki page
 */
export async function updatePage(options: {
  slug: string
  content: string
  summary?: string
  actorId?: string
  isMinor?: boolean
}): Promise<WikiPage> {
  const { slug, content, summary, actorId, isMinor = false } = options
  
  // Get existing page
  const page = await prisma.page.findUnique({
    where: { slug },
    include: {
      revisions: {
        orderBy: { revisionNumber: 'desc' },
        take: 1
      }
    }
  })
  
  if (!page) {
    throw new Error(`Page with slug "${slug}" not found`)
  }
  
  // Get or create actor
  let actor
  if (actorId) {
    actor = await prisma.actor.findUnique({
      where: { id: actorId }
    })
  }
  
  if (!actor) {
    // Try to find existing system actor first
    actor = await prisma.actor.findUnique({
      where: { name: 'system' }
    })
    
    if (!actor) {
      // Create anonymous actor
      actor = await prisma.actor.create({
        data: {
          name: 'system',
          userId: null
        }
      })
    }
  }
  
  // Create or find existing text content
  const crypto = require('crypto')
  const sha1 = crypto.createHash('sha1').update(content).digest('hex')
  
  let textContent = await prisma.textContent.findUnique({
    where: { sha1 }
  })
  
  if (!textContent) {
    textContent = await prisma.textContent.create({
      data: {
        content,
        sha1,
        byteSize: Buffer.byteLength(content, 'utf8')
      }
    })
  }
  
  // Get next revision number
  const nextRevisionNumber = (page.revisions[0]?.revisionNumber || 0) + 1
  
  // Create new revision
  const revision = await prisma.revision.create({
    data: {
      pageId: page.id,
      textId: textContent.id,
      actorId: actor.id,
      summary: summary || 'Edit',
      revisionNumber: nextRevisionNumber,
      timestamp: new Date(),
      isMinor
    }
  })
  
  // Update page with latest revision
  await prisma.page.update({
    where: { id: page.id },
    data: {
      latestRevisionId: revision.id,
      updatedAt: new Date()
    }
  })
  
  // Create recent change entry
  await prisma.recentChange.create({
    data: {
      actorId: actor.id,
      pageId: page.id,
      revisionId: revision.id,
      type: 'edit',
      oldRevisionId: page.revisions[0]?.id,
      oldLength: page.revisions[0] ? Buffer.byteLength(page.revisions[0].textContent?.content || '', 'utf8') : 0,
      newLength: textContent.byteSize
    }
  })
  
  // Update categories
  const categoryRegex = /\[\[Category:([^\]]+)\]\]/gi
  const categories: string[] = []
  let match
  
  while ((match = categoryRegex.exec(content)) !== null) {
    categories.push(match[1].trim())
  }
  
  // Remove existing category links
  await prisma.pageCategory.deleteMany({
    where: { pageId: page.id }
  })
  
  // Add new category links
  if (categories.length > 0) {
    await linkCategoriesToPage(page.id, categories)
  }
  
  // Return the updated page
  return _getPageBySlug(slug)
}