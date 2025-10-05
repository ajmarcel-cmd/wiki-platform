/**
 * Event handlers for wiki events
 * Handles search indexing, cache invalidation, etc.
 */

import { subscribeToEvents, EventType, WikiEvent } from './events'
import { indexPage, removePageFromIndex } from './search'
import { getPageBySlug } from './wiki'
import { revalidateTag } from 'next/cache'

/**
 * Initialize all event handlers
 */
export async function initializeEventHandlers() {
  console.log('📡 Initializing event handlers...')

  await subscribeToEvents(async (event: WikiEvent) => {
    try {
      switch (event.type) {
        case EventType.PAGE_CREATED:
        case EventType.PAGE_UPDATED:
          await handlePageUpdate(event)
          break

        case EventType.PAGE_DELETED:
          await handlePageDelete(event)
          break

        case EventType.SEARCH_INDEX_REQUEST:
          await handleSearchIndexRequest(event)
          break

        case EventType.CACHE_INVALIDATE:
          await handleCacheInvalidate(event)
          break

        case EventType.PAGE_VIEWED:
          // Could aggregate view counts here
          break

        default:
          console.log('Unknown event type:', event.type)
      }
    } catch (error) {
      console.error('Event handler error:', error)
    }
  })

  console.log('✅ Event handlers initialized')
}

/**
 * Handle page create/update events
 */
async function handlePageUpdate(event: WikiEvent) {
  const { slug } = event.data

  try {
    // Fetch the page
    const page = await getPageBySlug(slug)
    if (!page) return

    // Index in search
    await indexPage({
      id: page.id,
      slug: page.slug,
      title: page.title,
      displayTitle: page.displayTitle,
      content: page.content,
      namespace: page.namespace,
      categories: page.categories.map((c) => c.name),
      updatedAt: new Date(page.updatedAt).getTime(),
      viewCount: page.viewCount,
    })

    // Invalidate cache
    revalidateTag(`page:${slug}`)

    console.log(`✅ Indexed page: ${slug}`)
  } catch (error) {
    console.error(`Failed to handle page update for ${slug}:`, error)
  }
}

/**
 * Handle page delete events
 */
async function handlePageDelete(event: WikiEvent) {
  const { pageId, slug } = event.data

  try {
    // Remove from search index
    await removePageFromIndex(pageId)

    // Invalidate cache
    revalidateTag(`page:${slug}`)

    console.log(`✅ Removed page from index: ${slug}`)
  } catch (error) {
    console.error(`Failed to handle page delete for ${slug}:`, error)
  }
}

/**
 * Handle search index requests
 */
async function handleSearchIndexRequest(event: WikiEvent) {
  const { pageId } = event.data

  try {
    // This would fetch the page and index it
    // Implementation similar to handlePageUpdate
    console.log(`Indexing page: ${pageId}`)
  } catch (error) {
    console.error(`Failed to index page ${pageId}:`, error)
  }
}

/**
 * Handle cache invalidation events
 */
async function handleCacheInvalidate(event: WikiEvent) {
  const { key } = event.data

  try {
    revalidateTag(key)
    console.log(`✅ Invalidated cache: ${key}`)
  } catch (error) {
    console.error(`Failed to invalidate cache for ${key}:`, error)
  }
}
