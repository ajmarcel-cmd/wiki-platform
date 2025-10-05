/**
 * Cache utilities for wiki content
 * Initially using Next.js built-in caching, can be extended to Redis
 */

import { unstable_cache } from 'next/cache'

export interface CacheConfig {
  revalidate?: number | false
  tags?: string[]
}

/**
 * Create a cached function with configurable revalidation
 * In production, this can be extended to use Redis or another cache backend
 */
export function createCachedFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyPrefix: string,
  config?: CacheConfig
): T {
  return ((...args: Parameters<T>) => {
    const cacheKey = `${keyPrefix}:${JSON.stringify(args)}`
    
    return unstable_cache(
      async () => fn(...args),
      [cacheKey],
      {
        revalidate: config?.revalidate,
        tags: config?.tags,
      }
    )()
  }) as T
}

/**
 * Cache tags for invalidation
 */
export const CacheTags = {
  page: (slug: string) => `page:${slug}`,
  category: (slug: string) => `category:${slug}`,
  search: (query: string) => `search:${query}`,
  allPages: 'pages:all',
  allCategories: 'categories:all',
} as const

/**
 * Default cache times (in seconds)
 */
export const CacheDurations = {
  page: 3600, // 1 hour
  category: 3600, // 1 hour
  search: 300, // 5 minutes
  list: 600, // 10 minutes
  static: false, // Never revalidate
} as const
