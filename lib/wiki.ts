/**
 * Wiki data access layer
 * All database queries for wiki pages and related content
 */

import type { Prisma } from '@prisma/client'
import { prisma } from './db'
import crypto from 'crypto'
import { createCachedFunction, CacheDurations } from './cache'

export const DEFAULT_NAMESPACE_NAME = 'Main'
const DEFAULT_NAMESPACE = DEFAULT_NAMESPACE_NAME
const KNOWN_NAMESPACE_NAMES = new Set([
  'Category',
  'File',
  'Template',
  'Help',
  'Portal',
  'Project',
  'Talk',
  'User',
  'Main'
])

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function generatePageSlug(title: string, namespace: string = DEFAULT_NAMESPACE): string {
  const base = slugify(title)
  if (!namespace || namespace === DEFAULT_NAMESPACE) {
    return base
  }

  const namespaceSlug = slugify(namespace)
  if (!namespaceSlug) {
    return base
  }

  return `${namespaceSlug}-${base}`
}

export function generateCategorySlug(name: string): string {
  return slugify(name)
}

export async function normalizeTitle(
  rawTitle: string
): Promise<{ title: string; namespace: string; namespaceId: number; slug: string }> {
  const trimmed = rawTitle.trim()

  if (!trimmed) {
    throw new Error('Title cannot be empty')
  }

  const parts = trimmed.split(':')
  let namespaceName = DEFAULT_NAMESPACE
  let title = trimmed
  let namespaceRecord = await prisma.namespace.findUnique({
    where: { name: DEFAULT_NAMESPACE },
  })

  if (parts.length > 1) {
    const potentialNamespace = parts[0].trim()
    const remainder = parts.slice(1).join(':').trim()

    if (!remainder) {
      throw new Error('Title cannot be empty')
    }

    const existingNamespace = await prisma.namespace.findUnique({
      where: { name: potentialNamespace },
    })

    if (existingNamespace || KNOWN_NAMESPACE_NAMES.has(potentialNamespace)) {
      namespaceName = existingNamespace?.name || potentialNamespace
      namespaceRecord = existingNamespace ?? namespaceRecord
      title = remainder
    }
  }

  if (!namespaceRecord || namespaceRecord.name !== namespaceName) {
    namespaceRecord = await prisma.namespace.upsert({
      where: { name: namespaceName },
      update: {},
      create: {
        name: namespaceName,
        displayName: namespaceName,
        canonical: namespaceName === DEFAULT_NAMESPACE,
      },
    })
  }

  return {
    title,
    namespace: namespaceRecord.name,
    namespaceId: namespaceRecord.id,
    slug: generatePageSlug(title, namespaceRecord.name)
  }
}

export interface WikiPage {
  id: string
  slug: string
  title: string
  displayTitle: string
  content: string
  namespace: string
  namespaceId: number
  categories: Array<{ name: string; slug: string }>
  updatedAt: Date
  viewCount: number
  isRedirect: boolean
  redirectTarget: string | null
  isNew: boolean
  random: number
  touched: Date | null
  linksUpdated: Date | null
  length: number
  contentModel: string
  lang: string | null
  latestRevisionId: string | null
}

export interface WikiPageListItem {
  id: string
  slug: string
  title: string
  displayTitle: string
  namespace: string
  namespaceId: number
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
    namespaceId: page.namespace.id,
    categories: page.categories.map((pc) => ({
      name: pc.category.displayName,
      slug: pc.category.slug,
    })),
    updatedAt: page.updatedAt,
    viewCount: page.viewCount,
    isRedirect: page.isRedirect,
    redirectTarget: page.redirectTarget,
    isNew: page.isNew,
    random: page.random,
    touched: page.touched,
    linksUpdated: page.linksUpdated,
    length: page.length,
    contentModel: page.contentModel,
    lang: page.lang,
    latestRevisionId: page.latestRevisionId,
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
      id: p.id,
      slug: p.slug,
      title: p.title,
      displayTitle: p.displayTitle,
      namespace: p.namespace.name,
      namespaceId: p.namespace.id,
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
      id: p.id,
      slug: p.slug,
      title: p.title,
      displayTitle: p.displayTitle,
      namespace: p.namespace.name,
      namespaceId: p.namespace.id,
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
    id: p.id,
    slug: p.slug,
    title: p.title,
    displayTitle: p.displayTitle,
    namespace: p.namespace.name,
    namespaceId: p.namespace.id,
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
      id: pc.page.id,
      slug: pc.page.slug,
      title: pc.page.title,
      displayTitle: pc.page.displayTitle,
      namespace: pc.page.namespace.name,
      namespaceId: pc.page.namespace.id,
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
      touched: new Date(),
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
    include: {
      actor: true,
      comment: true,
    },
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

export interface SiteStats {
  pages: number
  articles: number
  files: number
  categories: number
  edits: number
  activeUsers: number
}

export interface NamespaceInfo {
  id: number
  name: string
  displayName: string
  canonical: boolean
}

export async function getNamespaces(): Promise<NamespaceInfo[]> {
  const namespaces = await prisma.namespace.findMany({
    orderBy: {
      id: 'asc',
    },
  })

  return namespaces.map((namespace) => ({
    id: namespace.id,
    name: namespace.name,
    displayName: namespace.displayName,
    canonical: namespace.canonical,
  }))
}

export async function getSiteStats(): Promise<SiteStats> {
  const [pages, articles, files, categories, edits, activeUsers] = await Promise.all([
    prisma.page.count(),
    prisma.page.count({
      where: {
        namespace: {
          name: DEFAULT_NAMESPACE,
        },
      },
    }),
    prisma.media.count(),
    prisma.category.count(),
    prisma.revision.count(),
    prisma.user.count({
      where: {
        isActive: true,
      },
    }),
  ])

  return {
    pages,
    articles,
    files,
    categories,
    edits,
    activeUsers,
  }
}

export interface PageListResult {
  items: WikiPageListItem[]
  continue?: string
}

export async function listAllPagesForApi(
  options: {
    limit?: number
    continueFrom?: string
    prefix?: string
  } = {}
): Promise<PageListResult> {
  const { limit = 50, continueFrom, prefix } = options
  const pageSize = Math.min(Math.max(limit, 1), 500)

  const query: Prisma.PageFindManyArgs = {
    orderBy: { slug: 'asc' },
    take: pageSize + 1,
    include: {
      namespace: true,
    },
  }

  if (continueFrom) {
    query.cursor = { slug: continueFrom }
    query.skip = 1
  }

  if (prefix) {
    query.where = {
      slug: {
        startsWith: slugify(prefix),
      },
    }
  }

  const pages = await prisma.page.findMany(query)
  const hasMore = pages.length > pageSize
  const items = hasMore ? pages.slice(0, pageSize) : pages
  const nextContinue = hasMore ? pages[pageSize].slug : undefined

  return {
    items: items.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      displayTitle: p.displayTitle,
      namespace: p.namespace.name,
      namespaceId: p.namespace.id,
      updatedAt: p.updatedAt,
      viewCount: p.viewCount,
    })),
    continue: nextContinue,
  }
}

export interface CategoryListItem {
  slug: string
  name: string
  displayName: string
  description: string | null
  pageCount: number
  mediaCount: number
}

export async function listAllCategoriesForApi(
  options: {
    limit?: number
    continueFrom?: string
    prefix?: string
  } = {}
): Promise<{ items: CategoryListItem[]; continue?: string }> {
  const { limit = 100, continueFrom, prefix } = options
  const pageSize = Math.min(Math.max(limit, 1), 500)

  const query: Prisma.CategoryFindManyArgs = {
    orderBy: { slug: 'asc' },
    take: pageSize + 1,
    include: {
      _count: {
        select: {
          pages: true,
          media: true,
        },
      },
    },
  }

  if (continueFrom) {
    query.cursor = { slug: continueFrom }
    query.skip = 1
  }

  if (prefix) {
    query.where = {
      slug: {
        startsWith: generateCategorySlug(prefix),
      },
    }
  }

  const categories = await prisma.category.findMany(query)
  const hasMore = categories.length > pageSize
  const items = hasMore ? categories.slice(0, pageSize) : categories
  const nextContinue = hasMore ? categories[pageSize].slug : undefined

  return {
    items: items.map((category) => ({
      slug: category.slug,
      name: category.name,
      displayName: category.displayName,
      description: category.description ?? null,
      pageCount: category._count.pages,
      mediaCount: category._count.media,
    })),
    continue: nextContinue,
  }
}

export interface CategoryTreeNode {
  slug: string
  name: string
  displayName: string
  description: string | null
  pageCount: number
  mediaCount: number
  parents: string[]
  subcategories: CategoryTreeNode[]
}

export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: {
          pages: true,
          media: true,
        },
      },
      page: {
        include: {
          namespace: true,
        },
      },
      pages: {
        include: {
          page: {
            include: {
              namespace: true,
            },
          },
        },
      },
    },
    orderBy: {
      displayName: 'asc',
    },
  })

  type CategoryMetadata = {
    slug: string
    name: string
    displayName: string
    description: string | null
    pageCount: number
    mediaCount: number
    parents: string[]
  }

  const metadata = new Map<string, CategoryMetadata>()
  const categoryByPageId = new Map<string, string>()

  const ensureMetadata = (
    slug: string,
    fallback: Partial<CategoryMetadata> = {}
  ): CategoryMetadata => {
    if (!metadata.has(slug)) {
      metadata.set(slug, {
        slug,
        name: fallback.name ?? slug,
        displayName: fallback.displayName ?? fallback.name ?? slug,
        description: fallback.description ?? null,
        pageCount: fallback.pageCount ?? 0,
        mediaCount: fallback.mediaCount ?? 0,
        parents: fallback.parents ?? [],
      })
    }

    return metadata.get(slug)!
  }

  for (const category of categories) {
    const meta = ensureMetadata(category.slug, {
      name: category.name,
      displayName: category.displayName,
      description: category.description ?? null,
      pageCount: category._count.pages,
      mediaCount: category._count.media,
    })

    // Ensure counts are up to date if the category already existed as a placeholder
    meta.name = category.name
    meta.displayName = category.displayName
    meta.description = category.description ?? null
    meta.pageCount = category._count.pages
    meta.mediaCount = category._count.media

    if (category.pageId) {
      categoryByPageId.set(category.pageId, category.slug)
    }
  }

  const parentToChildren = new Map<string, Set<string>>()
  const childToParents = new Map<string, Set<string>>()

  const registerRelationship = (parentSlug: string, childSlug: string) => {
    if (!parentToChildren.has(parentSlug)) {
      parentToChildren.set(parentSlug, new Set())
    }
    parentToChildren.get(parentSlug)!.add(childSlug)

    if (!childToParents.has(childSlug)) {
      childToParents.set(childSlug, new Set())
    }
    childToParents.get(childSlug)!.add(parentSlug)
  }

  for (const category of categories) {
    for (const membership of category.pages) {
      const page = membership.page

      if (!page || page.namespace?.name !== 'Category') {
        continue
      }

      let childSlug = categoryByPageId.get(page.id)

      if (!childSlug) {
        childSlug = generateCategorySlug(page.title)
        ensureMetadata(childSlug, {
          name: page.title,
          displayName: page.displayTitle,
        })
      }

      registerRelationship(category.slug, childSlug)
    }
  }

  for (const [childSlug, parents] of childToParents.entries()) {
    const meta = ensureMetadata(childSlug)
    meta.parents = Array.from(parents).sort((a, b) => {
      const parentA = ensureMetadata(a)
      const parentB = ensureMetadata(b)
      return parentA.displayName.localeCompare(parentB.displayName)
    })
  }

  const buildNode = (slug: string, lineage: Set<string>): CategoryTreeNode => {
    const meta = ensureMetadata(slug)
    const nextLineage = new Set(lineage)
    nextLineage.add(slug)

    const childSlugs = parentToChildren.get(slug)
    const subcategories: CategoryTreeNode[] = []

    if (childSlugs) {
      const sortedChildren = Array.from(childSlugs).sort((a, b) => {
        const childA = ensureMetadata(a)
        const childB = ensureMetadata(b)
        return childA.displayName.localeCompare(childB.displayName)
      })

      for (const childSlug of sortedChildren) {
        if (nextLineage.has(childSlug)) {
          continue
        }

        subcategories.push(buildNode(childSlug, nextLineage))
      }
    }

    return {
      slug: meta.slug,
      name: meta.name,
      displayName: meta.displayName,
      description: meta.description,
      pageCount: meta.pageCount,
      mediaCount: meta.mediaCount,
      parents: meta.parents,
      subcategories,
    }
  }

  const rootSlugs = Array.from(metadata.keys()).filter((slug) => {
    const parents = childToParents.get(slug)
    return !parents || parents.size === 0
  })

  const sortedRoots = rootSlugs.sort((a, b) => {
    const rootA = ensureMetadata(a)
    const rootB = ensureMetadata(b)
    return rootA.displayName.localeCompare(rootB.displayName)
  })

  return sortedRoots.map((slug) => buildNode(slug, new Set()))
}

export interface RecentChangeItem {
  id: string
  type: string
  timestamp: Date
  actorId: string
  pageId: string
  pageTitle: string
  pageSlug: string
  namespaceId: number
  namespace: string
  revisionId?: string | null
  oldRevisionId?: string | null
  oldLength?: number | null
  newLength?: number | null
}

export async function getRecentChanges(
  options: {
    limit?: number
    continueFrom?: string
  } = {}
): Promise<{ items: RecentChangeItem[]; continue?: string }> {
  const { limit = 50, continueFrom } = options
  const pageSize = Math.min(Math.max(limit, 1), 500)

  const where: Prisma.RecentChangeWhereInput | undefined = continueFrom
    ? {
        timestamp: {
          lt: new Date(continueFrom),
        },
      }
    : undefined

  const changes = await prisma.recentChange.findMany({
    where,
    orderBy: [
      { timestamp: 'desc' },
      { id: 'desc' },
    ],
    take: pageSize + 1,
    include: {
      page: {
        include: {
          namespace: true,
        },
      },
    },
  })

  const hasMore = changes.length > pageSize
  const items = hasMore ? changes.slice(0, pageSize) : changes
  const nextContinue = hasMore ? changes[pageSize].timestamp.toISOString() : undefined

  return {
    items: items.map((change) => ({
      id: change.id,
      type: change.type,
      timestamp: change.timestamp,
      actorId: change.actorId,
      pageId: change.pageId,
      pageTitle: change.page?.title ?? '',
      pageSlug: change.page?.slug ?? '',
      namespaceId: change.page?.namespace?.id ?? 0,
      namespace: change.page?.namespace?.name ?? DEFAULT_NAMESPACE,
      revisionId: change.revisionId,
      oldRevisionId: change.oldRevisionId,
      oldLength: change.oldLength,
      newLength: change.newLength,
    })),
    continue: nextContinue,
  }
}

/**
 * Link categories to a page
 */
export async function linkCategoriesToPage(pageId: string, categoryNames: string[]) {
  for (const categoryName of categoryNames) {
    // Find or create category
    const slug = generateCategorySlug(categoryName)

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
  const slug = generatePageSlug(title, namespaceRecord.name)
  
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
  const now = new Date()
  const page = await prisma.page.create({
    data: {
      namespaceId: namespaceRecord.id,
      title,
      displayTitle: title,
      slug,
      latestRevisionId: null, // Will be set after creating revision
      isRedirect: false,
      redirectTarget: null,
      viewCount: 0,
      isNew: true,
      random: Math.random(),
      touched: now,
      linksUpdated: now,
      length: textContent.byteSize,
      contentModel: 'wikitext',
      lang: 'en'
    }
  })

  // Create initial revision
  const commentText = summary || 'Initial creation'
  const commentHash = crypto.createHash('sha1').update(commentText).digest('hex')
  const comment = await prisma.comment.upsert({
    where: { hash: commentHash },
    create: {
      text: commentText,
      hash: commentHash
    },
    update: {}
  })
  const revision = await prisma.revision.create({
    data: {
      pageId: page.id,
      textId: textContent.id,
      actorId: actor.id,
      summary: commentText,
      revisionNumber: 1,
      timestamp: now,
      isMinor: false,
      commentId: comment.id,
      byteSize: textContent.byteSize,
      sha1,
      contentModel: 'wikitext',
      contentFormat: 'text/x-wiki'
    }
  })

  // Update page with latest revision
  await prisma.page.update({
    where: { id: page.id },
    data: {
      latestRevisionId: revision.id,
      length: textContent.byteSize
    }
  })

  if (namespaceRecord.name === 'Category') {
    const categorySlug = generateCategorySlug(title)
    const summaryData = summary ?? undefined

    await prisma.category.upsert({
      where: { slug: categorySlug },
      update: {
        name: title,
        displayName: title,
        ...(summary !== undefined ? { description: summaryData } : {}),
        pageId: page.id
      },
      create: {
        name: title,
        displayName: title,
        slug: categorySlug,
        description: summary ?? null,
        pageId: page.id
      }
    })
  }

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
      namespace: true,
      revisions: {
        orderBy: { revisionNumber: 'desc' },
        take: 1,
        include: {
          textContent: true
        }
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
  const commentText = summary || 'Edit'
  const commentHash = crypto.createHash('sha1').update(commentText).digest('hex')
  const comment = await prisma.comment.upsert({
    where: { hash: commentHash },
    create: {
      text: commentText,
      hash: commentHash
    },
    update: {}
  })

  const revision = await prisma.revision.create({
    data: {
      pageId: page.id,
      textId: textContent.id,
      actorId: actor.id,
      summary: commentText,
      revisionNumber: nextRevisionNumber,
      timestamp: new Date(),
      isMinor,
      parentRevisionId: page.revisions[0]?.id,
      commentId: comment.id,
      byteSize: textContent.byteSize,
      sha1,
      contentModel: 'wikitext',
      contentFormat: 'text/x-wiki'
    }
  })
  
  // Update page with latest revision
  await prisma.page.update({
    where: { id: page.id },
    data: {
      latestRevisionId: revision.id,
      updatedAt: new Date(),
      length: textContent.byteSize,
      linksUpdated: new Date(),
      isNew: false
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
  
  if (page.namespace.name === 'Category') {
    const categorySlug = generateCategorySlug(page.title)
    const summaryData = summary ?? undefined

    await prisma.category.upsert({
      where: { slug: categorySlug },
      update: {
        name: page.title,
        displayName: page.displayTitle,
        ...(summary !== undefined ? { description: summaryData } : {}),
        pageId: page.id
      },
      create: {
        name: page.title,
        displayName: page.displayTitle,
        slug: categorySlug,
        description: summary ?? null,
        pageId: page.id
      }
    })
  }

  // Return the updated page
  return _getPageBySlug(slug)
}