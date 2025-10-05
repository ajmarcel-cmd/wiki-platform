/**
 * Advanced search with Meilisearch
 * Provides instant search with typo tolerance, filters, and ranking
 */

import { MeiliSearch } from 'meilisearch'

const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST || 'http://localhost:7700'
const MEILISEARCH_KEY = process.env.MEILISEARCH_API_KEY || ''

// Initialize Meilisearch client
let meiliClient: MeiliSearch | null = null

function getMeiliClient(): MeiliSearch | null {
  if (!MEILISEARCH_HOST) {
    console.warn('Meilisearch not configured, falling back to database search')
    return null
  }

  if (!meiliClient) {
    meiliClient = new MeiliSearch({
      host: MEILISEARCH_HOST,
      apiKey: MEILISEARCH_KEY,
    })
  }

  return meiliClient
}

export interface SearchDocument {
  id: string
  slug: string
  title: string
  displayTitle: string
  content: string
  namespace: string
  categories: string[]
  updatedAt: number
  viewCount: number
}

export interface SearchResult {
  slug: string
  title: string
  displayTitle: string
  namespace: string
  excerpt?: string
  _formatted?: {
    title?: string
    content?: string
  }
}

/**
 * Initialize search index
 */
export async function initializeSearchIndex() {
  const client = getMeiliClient()
  if (!client) return

  try {
    const index = client.index('pages')

    // Configure searchable attributes
    await index.updateSearchableAttributes([
      'title',
      'displayTitle',
      'content',
      'categories'
    ])

    // Configure ranking rules
    await index.updateRankingRules([
      'words',
      'typo',
      'proximity',
      'attribute',
      'sort',
      'exactness',
      'viewCount:desc'
    ])

    // Configure filterable attributes
    await index.updateFilterableAttributes([
      'namespace',
      'categories',
      'updatedAt'
    ])

    // Configure sortable attributes
    await index.updateSortableAttributes([
      'viewCount',
      'updatedAt'
    ])

    console.log('✅ Search index initialized')
  } catch (error) {
    console.error('Failed to initialize search index:', error)
  }
}

/**
 * Index a page in search
 */
export async function indexPage(page: SearchDocument) {
  const client = getMeiliClient()
  if (!client) return

  try {
    const index = client.index('pages')
    await index.addDocuments([page], { primaryKey: 'id' })
  } catch (error) {
    console.error('Failed to index page:', error)
    throw error
  }
}

/**
 * Index multiple pages in batch
 */
export async function indexPages(pages: SearchDocument[]) {
  const client = getMeiliClient()
  if (!client) return

  try {
    const index = client.index('pages')
    await index.addDocuments(pages, { primaryKey: 'id' })
    console.log(`✅ Indexed ${pages.length} pages`)
  } catch (error) {
    console.error('Failed to index pages:', error)
    throw error
  }
}

/**
 * Remove page from search index
 */
export async function removePageFromIndex(pageId: string) {
  const client = getMeiliClient()
  if (!client) return

  try {
    const index = client.index('pages')
    await index.deleteDocument(pageId)
  } catch (error) {
    console.error('Failed to remove page from index:', error)
  }
}

/**
 * Search pages with advanced features
 */
export async function searchWithMeilisearch(
  query: string,
  options?: {
    limit?: number
    offset?: number
    filter?: string
    sort?: string[]
  }
): Promise<SearchResult[]> {
  const client = getMeiliClient()
  if (!client) {
    return [] // Fallback to database search in the API route
  }

  try {
    const index = client.index('pages')
    const result = await index.search<SearchDocument>(query, {
      limit: options?.limit || 20,
      offset: options?.offset || 0,
      filter: options?.filter,
      sort: options?.sort,
      attributesToHighlight: ['title', 'content'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      attributesToCrop: ['content'],
      cropLength: 200,
    })

    return result.hits.map((hit) => ({
      slug: hit.slug,
      title: hit.title,
      displayTitle: hit.displayTitle,
      namespace: hit.namespace,
      excerpt: hit._formatted?.content,
      _formatted: hit._formatted,
    }))
  } catch (error) {
    console.error('Search error:', error)
    return []
  }
}

/**
 * Get search statistics
 */
export async function getSearchStats() {
  const client = getMeiliClient()
  if (!client) return null

  try {
    const index = client.index('pages')
    const stats = await index.getStats()
    return stats
  } catch (error) {
    console.error('Failed to get search stats:', error)
    return null
  }
}

/**
 * Check if Meilisearch is available
 */
export async function isMeilisearchAvailable(): Promise<boolean> {
  const client = getMeiliClient()
  if (!client) return false

  try {
    await client.health()
    return true
  } catch (error) {
    return false
  }
}
