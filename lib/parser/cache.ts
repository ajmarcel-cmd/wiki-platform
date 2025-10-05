/**
 * Parser Cache System
 * Caches parsed content and template results
 */

import { createHash } from 'crypto'
import { prisma } from '../db'
import { ParserContext } from './types'

interface CacheEntry {
  content: string
  hash: string
  timestamp: number
  dependencies: string[]
  expiresAt: number
}

interface CacheOptions {
  ttl?: number // Time to live in seconds
  dependencies?: string[] // List of dependencies that invalidate the cache
}

class ParserCache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly defaultTTL = 3600 // 1 hour
  private readonly maxCacheSize = 1000 // Maximum number of entries
  
  /**
   * Get a cached result
   */
  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    // Check if dependencies have changed
    if (entry.dependencies.length > 0) {
      const hasChanged = await this.checkDependencies(entry.dependencies, entry.timestamp)
      if (hasChanged) {
        this.cache.delete(key)
        return null
      }
    }
    
    return entry.content
  }
  
  /**
   * Set a cache entry
   */
  set(
    key: string,
    content: string,
    options: CacheOptions = {}
  ): void {
    // Generate content hash
    const hash = createHash('sha256')
      .update(content)
      .digest('hex')
    
    // Create cache entry
    const entry: CacheEntry = {
      content,
      hash,
      timestamp: Date.now(),
      dependencies: options.dependencies || [],
      expiresAt: Date.now() + (options.ttl || this.defaultTTL) * 1000
    }
    
    // Add to cache
    this.cache.set(key, entry)
    
    // Prune cache if too large
    if (this.cache.size > this.maxCacheSize) {
      this.prune()
    }
  }
  
  /**
   * Delete a cache entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }
  
  /**
   * Generate a cache key from context
   */
  generateKey(
    content: string,
    context: ParserContext,
    extraData: Record<string, any> = {}
  ): string {
    const data = {
      content,
      page: context.page,
      templateParams: context.templateParams,
      ...extraData
    }
    
    return createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
  }
  
  /**
   * Check if any dependencies have changed since timestamp
   */
  private async checkDependencies(
    dependencies: string[],
    timestamp: number
  ): Promise<boolean> {
    // Note: Templates are stored in-memory, not in the database
    // For now, we'll only check page dependencies
    
    // Check pages
    const pages = await prisma.page.findMany({
      where: {
        slug: { in: dependencies },
        updatedAt: { gt: new Date(timestamp) }
      }
    })
    
    if (pages.length > 0) {
      return true
    }
    
    return false
  }
  
  /**
   * Prune old entries from cache
   */
  private prune(): void {
    const now = Date.now()
    
    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
    
    // If still too large, remove oldest entries
    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toRemove = entries.slice(0, entries.length - this.maxCacheSize)
      for (const [key] of toRemove) {
        this.cache.delete(key)
      }
    }
  }
}

// Export singleton instance
export const parserCache = new ParserCache()
