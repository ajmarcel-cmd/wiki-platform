/**
 * Markdown/Wikitext parser and renderer
 * Converts wiki markup to HTML
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import matter from 'gray-matter'
import { prisma } from './db'
import type { Handler } from 'mdast-util-to-hast'
import { parseTemplateCalls, replaceTemplateCalls } from './templates/parser'
import { templateRegistry } from './templates/registry'
import './templates' // Initialize templates

/**
 * Parse and render markdown content to HTML
 */
export async function renderMarkdown(content: string): Promise<{
  html: string;
  tableOfContents: Array<{ level: number; text: string; id: string }>;
}> {
  // First, resolve image URLs to their latest versions
  let processedContent = await resolveImageUrlsToLatest(content)
  
  // Parse and render templates BEFORE markdown processing
  const templateCalls = parseTemplateCalls(processedContent)
  if (templateCalls.length > 0) {
    processedContent = replaceTemplateCalls(
      processedContent,
      templateCalls,
      (template) => templateRegistry.render(template)
    )
  }
  
  // Generate table of contents
  const { tocArray, tocHtml } = generateTableOfContents(processedContent)
  
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype, {
      // Add classes to tables for Wikipedia styling and handle image alignment
      handlers: {
        table: function(h, node) {
          return {
            type: 'element',
            tagName: 'table',
            properties: { className: ['wikitable'] },
            children: h.all(node)
          }
        } as Handler,
        image: function(h, node) {
          const { url, alt, title } = node
          const properties: any = {
            src: url,
            alt: alt || '',
            className: ['mw-file-element']
          }
          
          if (title) {
            properties.title = title
          }
          
          // Check for alignment hints in alt text or title
          let alignment = ''
          if (alt && alt.includes('left')) {
            alignment = 'mw-halign-left'
          } else if (alt && alt.includes('right')) {
            alignment = 'mw-halign-right'
          } else if (alt && alt.includes('center')) {
            alignment = 'mw-halign-center'
          } else {
            // Default to left alignment for better text wrapping
            alignment = 'mw-halign-left'
          }
          
          // Always wrap images in figure elements for consistent styling
          const imgElement = {
            type: 'element',
            tagName: 'img',
            properties,
            children: []
          }
          
          const figureElement: any = {
            type: 'element',
            tagName: 'figure',
            properties: {
              className: [alignment],
              typeof: 'mw:File/Thumb'
            },
            children: [
              {
                type: 'element',
                tagName: 'a',
                properties: {
                  href: `/file/${url.split('/').pop()}`,
                  className: ['mw-file-description']
                },
                children: [imgElement]
              }
            ]
          }
          
          // Add caption if title is provided
          if (title) {
            figureElement.children.push({
              type: 'element',
              tagName: 'figcaption',
              properties: {},
              children: [{ type: 'text', value: title } as any]
            })
          }
          
          return figureElement
        } as Handler
      }
    })
    .use(rehypeSanitize, {
      // Allow more HTML elements for Wikipedia-style formatting
      tagNames: [
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span', 'p', 'br', 'hr',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'blockquote', 'pre', 'code',
        'strong', 'em', 'b', 'i', 'u', 's',
        'a', 'img', 'figure', 'figcaption',
        'sup', 'sub', 'small', 'big'
      ],
      attributes: {
        '*': ['class', 'id', 'style', 'onclick'],
        'a': ['href', 'title', 'target', 'rel'],
        'img': ['src', 'alt', 'title', 'width', 'height', 'class', 'style'],
        'figure': ['class', 'style', 'typeof', 'className'],
        'figcaption': ['class', 'style'],
        'table': ['class', 'style', 'border', 'cellpadding', 'cellspacing'],
        'th': ['class', 'style', 'colspan', 'rowspan'],
        'td': ['class', 'style', 'colspan', 'rowspan'],
        'div': ['class', 'onclick']
      }
    })
    .use(rehypeStringify)

  const result = await processor.process(processedContent)
  let html = String(result)
  
  // Add IDs to headings
  html = addHeadingIds(html)
  
  // Process MediaWiki-style figure elements
  html = processMediaWikiFigures(html)
  
  // Insert TOC if it exists
  if (tocHtml) {
    const firstParagraphEnd = html.indexOf('</p>')
    if (firstParagraphEnd !== -1) {
      html = html.slice(0, firstParagraphEnd + 4) + tocHtml + html.slice(firstParagraphEnd + 4)
    }
  }
  
  return {
    html,
    tableOfContents: tocArray
  }
}

/**
 * Parse frontmatter from content
 */
export function parseFrontmatter(content: string) {
  try {
    const { data, content: markdownContent } = matter(content)
    return { data, content: markdownContent }
  } catch (error) {
    return { data: {}, content }
  }
}

/**
 * Extract internal links from wiki content
 * Matches [[Page Title]] or [[Page Title|Display Text]]
 */
export function extractInternalLinks(content: string): Array<{
  target: string
  display: string | null
}> {
  const linkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  const links: Array<{ target: string; display: string | null }> = []
  
  let match
  while ((match = linkRegex.exec(content)) !== null) {
    links.push({
      target: match[1].trim(),
      display: match[2] ? match[2].trim() : null,
    })
  }
  
  return links
}

/**
 * Convert internal wiki links to markdown links
 * Transforms [[Page Title]] to [Page Title](/wiki/Page_Title)
 */
export function convertInternalLinks(content: string): string {
  return content.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (match, target, display) => {
      const slug = target.trim().replace(/\s+/g, '_')
      const text = display ? display.trim() : target.trim()
      return `[${text}](/wiki/${encodeURIComponent(slug)})`
    }
  )
}

/**
 * Extract categories from content
 * Matches [[Category:Category Name]]
 */
export function extractCategories(content: string): string[] {
  const categoryRegex = /\[\[Category:([^\]]+)\]\]/gi
  const categories: string[] = []
  
  let match
  while ((match = categoryRegex.exec(content)) !== null) {
    categories.push(match[1].trim())
  }
  
  return categories
}

/**
 * Remove category links from content
 */
export function removeCategories(content: string): string {
  return content.replace(/\[\[Category:[^\]]+\]\]/gi, '')
}

/**
 * Generate table of contents from headings
 */
export function generateTableOfContents(content: string): {
  tocArray: Array<{ level: number; text: string; id: string }>;
  tocHtml: string;
} {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const tocArray: Array<{ level: number; text: string; id: string }> = []
  
  let match
  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length
    const text = match[2].trim()
    const id = text.toLowerCase().replace(/[^\w]+/g, '-')
    
    tocArray.push({ level, text, id })
  }
  
  if (tocArray.length === 0) {
    return { tocArray: [], tocHtml: '' }
  }

  let tocHtml = '<div class="toc">\n'
  tocHtml += '<div class="toc-header">\n'
  tocHtml += '<h2>Contents</h2>\n'
  tocHtml += '<span class="toc-toggle">[hide]</span>\n'
  tocHtml += '</div>\n'
  tocHtml += '<div class="toc-content">\n'
  tocHtml += '<ul>\n'

  let currentLevel = 1
  const listStack: string[] = []

  tocArray.forEach((heading, index) => {
    while (currentLevel < heading.level) {
      tocHtml += '<ul>\n'
      listStack.push('</ul>\n')
      currentLevel++
    }
    
    while (currentLevel > heading.level) {
      const lastItem = listStack.pop()
      if (lastItem) {
        tocHtml += lastItem
      }
      currentLevel--
    }

    const number = index + 1
    tocHtml += `<li><a href="#${heading.id}">${number}. ${heading.text}</a></li>\n`
  })

  while (listStack.length > 0) {
    const lastItem = listStack.pop()
    if (lastItem) {
      tocHtml += lastItem
    }
  }

  tocHtml += '</ul>\n'
  tocHtml += '</div>\n'
  tocHtml += '</div>'

  return { tocArray, tocHtml }
}

/**
 * Add IDs to headings for anchor links
 */
export function addHeadingIds(html: string): string {
  return html.replace(
    /<h([1-6])>(.+?)<\/h\1>/g,
    (match, level, text) => {
      const id = text.toLowerCase().replace(/[^\w]+/g, '-')
      return `<h${level} id="${id}">${text}</h${level}>`
    }
  )
}

/**
 * Resolve image URLs in content to their latest versions
 */
export async function resolveImageUrlsToLatest(content: string): Promise<string> {
  // Pattern to match markdown image syntax: ![alt](url)
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g
  
  const matches = Array.from(content.matchAll(imagePattern))
  
  for (const match of matches) {
    const [fullMatch, alt, url] = match
    const latestUrl = await getLatestImageUrl(url)
    
    if (latestUrl && latestUrl !== url) {
      content = content.replace(fullMatch, `![${alt}](${latestUrl})`)
    }
  }
  
  return content
}

/**
 * Get the latest URL for an image reference
 */
async function getLatestImageUrl(url: string): Promise<string | null> {
  try {
    // Extract filename from various URL formats
    let filename: string | null = null
    
    // Handle file page URLs: /file/filename.ext
    if (url.startsWith('/file/')) {
      filename = decodeURIComponent(url.replace('/file/', ''))
    }
    // Handle direct filename references
    else if (url.includes('/') && url.split('/').pop()?.includes('.')) {
      filename = url.split('/').pop() || null
    }
    // Handle simple filename references
    else if (url.includes('.') && !url.startsWith('http')) {
      filename = url
    }
    
    if (!filename) {
      return null
    }
    
    // Get the latest version from database
    const media = await prisma.media.findUnique({
      where: { filename },
    })
    
    return media?.url || null
  } catch (error) {
    console.error('Error resolving image URL:', error)
    return null
  }
}

/**
 * Process MediaWiki-style figure elements and convert them to proper HTML
 * Handles figure elements with mw-halign-left, mw-halign-right, etc.
 */
function processMediaWikiFigures(html: string): string {
  // Pattern to match MediaWiki-style figure elements
  const figurePattern = /<figure\s+class="mw-halign-(\w+)"\s+typeof="mw:File\/Thumb">\s*<a\s+href="([^"]+)"\s+class="mw-file-description">\s*<img\s+([^>]*?)\s*\/?>\s*<\/a>\s*(?:<figcaption>([^<]*)<\/figcaption>)?\s*<\/figure>/g
  
  return html.replace(figurePattern, (match, alignment, href, imgAttributes, caption) => {
    // Extract image attributes
    const srcMatch = imgAttributes.match(/src="([^"]*)"/)
    const altMatch = imgAttributes.match(/alt="([^"]*)"/)
    const widthMatch = imgAttributes.match(/width="([^"]*)"/)
    const heightMatch = imgAttributes.match(/height="([^"]*)"/)
    const classMatch = imgAttributes.match(/class="([^"]*)"/)
    
    const src = srcMatch ? srcMatch[1] : ''
    const alt = altMatch ? altMatch[1] : ''
    const width = widthMatch ? widthMatch[1] : ''
    const height = heightMatch ? heightMatch[1] : ''
    const imgClass = classMatch ? classMatch[1] : 'mw-file-element'
    
    // Build the figure element with proper alignment class
    let figureHtml = `<figure class="mw-halign-${alignment}" typeof="mw:File/Thumb">`
    figureHtml += `<a href="${href}" class="mw-file-description">`
    figureHtml += `<img src="${src}" alt="${alt}" class="${imgClass}"`
    
    if (width) figureHtml += ` width="${width}"`
    if (height) figureHtml += ` height="${height}"`
    
    figureHtml += ` />`
    figureHtml += `</a>`
    
    if (caption) {
      figureHtml += `<figcaption>${caption}</figcaption>`
    }
    
    figureHtml += `</figure>`
    
    return figureHtml
  })
}
