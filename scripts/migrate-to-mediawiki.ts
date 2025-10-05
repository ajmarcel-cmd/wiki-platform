/**
 * Migration Script
 * Converts existing wiki content to MediaWiki format
 */

import { prisma } from '../lib/db'
import { parseWikiContent, getPageContext } from '../lib/parser'

async function migrateContent() {
  console.log('Starting content migration...')
  
  // Get all pages
  const pages = await prisma.page.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      categories: true
    }
  })
  
  console.log(`Found ${pages.length} pages to migrate`)
  
  for (const page of pages) {
    try {
      console.log(`\nMigrating page: ${page.title}`)
      
      // Get page context
      const context = await getPageContext(page.slug)
      
      // Convert content
      let content = page.content
      
      // 1. Convert existing categories to MediaWiki format
      const existingCategories = page.categories || []
      content = content.replace(/\[\[Category:[^\]]+\]\]/gi, '') // Remove existing category tags
      content += '\n\n' + existingCategories
        .map(cat => `[[Category:${cat.name}]]`)
        .join('\n')
      
      // 2. Convert markdown-style links to MediaWiki format
      content = content.replace(/\[([^\]]+)\]\(\/wiki\/([^)]+)\)/g, (_, text, target) => {
        const displayText = text !== target.replace(/_/g, ' ') ? `|${text}` : ''
        return `[[${target.replace(/_/g, ' ')}${displayText}]]`
      })
      
      // 3. Convert markdown-style images to MediaWiki format
      content = content.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
        const filename = url.split('/').pop()
        return `[[File:${filename}|${alt}]]`
      })
      
      // 4. Convert markdown headings to MediaWiki format
      content = content.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, text) => {
        const level = hashes.length
        return `${'='.repeat(level)}${text}${'='.repeat(level)}`
      })
      
      // 5. Convert markdown lists to MediaWiki format
      content = content.replace(/^(\s*)-\s+/gm, '$1* ') // Unordered lists
      content = content.replace(/^(\s*)\d+\.\s+/gm, '$1# ') // Ordered lists
      
      // Test parse the converted content
      try {
        await parseWikiContent(content, context)
      } catch (error) {
        console.error(`Error parsing converted content for ${page.title}:`, error)
        continue
      }
      
      // Update the page with converted content
      await prisma.page.update({
        where: { id: page.id },
        data: { content }
      })
      
      console.log(`Successfully migrated: ${page.title}`)
    } catch (error) {
      console.error(`Error migrating page ${page.title}:`, error)
    }
  }
  
  console.log('\nMigration complete!')
}

// Run migration
migrateContent()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })
