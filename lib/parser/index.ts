/**
 * Parser Integration
 * Integrates MediaWiki parser with Next.js wiki system
 */

import { Parser } from './parser'
import { ParserContext, ParserOptions } from './types'
import { prisma } from '../db'

// Initialize parser with default options
const parser = new Parser({
  expandTemplates: true,
  maxTemplateDepth: 40,
  allowHTML: true,
  generateTOC: true,
  processCategories: true,
  magicWords: {
    SITENAME: 'Nintendo Wiki',
    SERVER: process.env.NEXT_PUBLIC_SITE_URL || '',
    SERVERNAME: process.env.NEXT_PUBLIC_SITE_DOMAIN || '',
    DIRECTIONMARK: 'ltr',
    CONTENTLANGUAGE: 'en',
    CONTENTLANG: 'en'
  }
})

/**
 * Parse wiki content to HTML
 */
export async function parseWikiContent(content: string, context: Partial<ParserContext> = {}): Promise<{
  html: string
  categories: string[]
  tableOfContents: Array<{ level: number; text: string; id: string }>
}> {
  // Extract categories before parsing
  const categoryRegex = /\[\[Category:([^\]]+)\]\]/gi
  const categories: string[] = []
  let match
  
  while ((match = categoryRegex.exec(content)) !== null) {
    categories.push(match[1].trim())
  }
  
  // Remove categories from content
  const contentWithoutCategories = content.replace(/\[\[Category:[^\]]+\]\]/gi, '')
  
  // Parse content
  const html = await parser.parse(contentWithoutCategories, context)
  
  // Extract table of contents
  const tocRegex = /<h([1-6])\s+id="([^"]+)"[^>]*>([^<]+)<\/h\1>/g
  const tableOfContents: Array<{ level: number; text: string; id: string }> = []
  
  let tocMatch
  while ((tocMatch = tocRegex.exec(html)) !== null) {
    tableOfContents.push({
      level: parseInt(tocMatch[1]),
      id: tocMatch[2],
      text: tocMatch[3]
    })
  }
  
  return {
    html,
    categories,
    tableOfContents
  }
}

/**
 * Parse wiki content for preview (no template expansion)
 */
export async function parseWikiPreview(content: string): Promise<string> {
  const previewParser = new Parser({
    expandTemplates: false,
    allowHTML: true,
    generateTOC: false,
    processCategories: false
  })
  
  return await previewParser.parse(content)
}

/**
 * Get page context for parser
 */
export async function getPageContext(slug: string): Promise<ParserContext> {
  const page = await prisma.page.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      namespace: {
        select: {
          name: true
        }
      },
      latestRevisionId: true
    }
  })
  
  if (!page) {
    return {
      page: {
        title: '',
        namespace: ''
      },
      templateParams: {},
      recursionDepth: 0,
      expandTemplates: true,
      magicWords: {},
      templateCache: new Map()
    }
  }
  
  return {
    page: {
      title: page.title,
      namespace: page.namespace.name || ''
    },
    templateParams: {},
    recursionDepth: 0,
    expandTemplates: true,
    magicWords: {},
    templateCache: new Map()
  }
}
