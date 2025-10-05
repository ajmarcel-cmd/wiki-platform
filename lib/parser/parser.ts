/**
 * MediaWiki Parser
 * Converts wiki text to HTML using MediaWiki syntax
 */

import { Token, TokenType, ParserContext, ParserOptions } from './types'
import { Tokenizer } from './tokenizer'
import { executeParserFunction } from './functions'
import { templateRegistry } from '../templates/registry'
import { parserCache } from './cache'

export class Parser {
  private context: ParserContext
  private options: ParserOptions
  
  constructor(options: ParserOptions = {}) {
    this.options = {
      expandTemplates: true,
      maxTemplateDepth: 40,
      allowHTML: true,
      generateTOC: true,
      processCategories: true,
      ...options
    }
    
    this.context = {
      page: {
        title: '',
        namespace: ''
      },
      templateParams: {},
      recursionDepth: 0,
      expandTemplates: this.options.expandTemplates ?? true,
      magicWords: {
        PAGENAME: () => this.context.page.title,
        NAMESPACE: () => this.context.page.namespace,
        CURRENTYEAR: () => new Date().getFullYear().toString(),
        CURRENTMONTH: () => (new Date().getMonth() + 1).toString().padStart(2, '0'),
        CURRENTDAY: () => new Date().getDate().toString(),
        CURRENTTIME: () => new Date().toLocaleTimeString(),
        ...options.magicWords
      },
      templateCache: new Map()
    }
  }
  
  /**
   * Parse wiki text to HTML
   */
  async parse(text: string, pageContext?: Partial<ParserContext>): Promise<string> {
    // Update context with page info
    if (pageContext) {
      this.context = {
        ...this.context,
        ...pageContext
      }
    }
    
    // Generate cache key
    const cacheKey = parserCache.generateKey(text, this.context, {
      flags: this.options,
      version: '1.1.0' // Parser version - updated for inline link parsing fix
    })
    
    // Check cache
    const cached = await parserCache.get(cacheKey)
    if (cached) {
      return cached
    }
    // Tokenize input
    const tokenizer = new Tokenizer(text)
    const tokens = tokenizer.tokenize()
    
    // Process tokens
    const result = this.processTokens(tokens)
    
    // Cache result
    parserCache.set(cacheKey, result, {
      dependencies: this.getDependencies(tokens),
      ttl: 3600 // 1 hour
    })
    
    return result
  }
  
  /**
   * Process a list of tokens into HTML
   */
  private processTokens(tokens: Token[]): string {
    let html = ''
    let i = 0
    
    while (i < tokens.length) {
      const token = tokens[i]
      
      switch (token.type) {
        case TokenType.TEXT:
          // Collect consecutive text and newlines into a paragraph
          let paragraph = ''
          let hasContent = false
          while (i < tokens.length && (tokens[i].type === TokenType.TEXT || tokens[i].type === TokenType.NEWLINE || tokens[i].type === TokenType.LINK)) {
            if (tokens[i].type === TokenType.TEXT) {
              const text = tokens[i].text.trim()
              if (text) {
                // Process inline formatting first, then escape HTML
                const processed = this.processInline(text)
                paragraph += processed + ' '
                hasContent = true
              }
            } else if (tokens[i].type === TokenType.NEWLINE) {
              // Check for double newline (paragraph break)
              if (i + 1 < tokens.length && tokens[i + 1].type === TokenType.NEWLINE) {
                if (hasContent) {
                  html += `<p>${paragraph.trim()}</p>`
                  paragraph = ''
                  hasContent = false
                }
                i++
              }
            } else if (tokens[i].type === TokenType.LINK) {
              if (tokens[i].attributes?.external === 'true') {
                paragraph += this.renderExternalLink(tokens[i])
              } else {
                paragraph += this.renderInternalLink(tokens[i])
              }
              hasContent = true
            }
            i++
          }
          if (hasContent) {
            html += `<p>${paragraph.trim()}</p>`
          }
          continue
          
        case TokenType.NEWLINE:
          i++
          continue
          
        case TokenType.HEADING:
          const level = parseInt(token.attributes?.level || '2')
          const headingId = this.generateHeadingId(token.text)
          html += `<h${level} id="${headingId}">${this.processInline(token.text)}</h${level}>`
          break
          
        case TokenType.LINK:
          if (token.attributes?.external === 'true') {
            html += this.renderExternalLink(token)
          } else {
            html += this.renderInternalLink(token)
          }
          break
          
        case TokenType.TEMPLATE:
          if (this.context.expandTemplates) {
            html += this.expandTemplate(token)
          } else {
            html += token.text
          }
          break
          
        case TokenType.PARSER_FUNCTION:
          html += this.executeParserFunction(token)
          break
          
        case TokenType.MAGIC_WORD:
          html += this.expandMagicWord(token)
          break
          
        case TokenType.HTML:
          if (this.options.allowHTML) {
            html += this.renderHTML(token)
          } else {
            html += this.escapeHTML(token.text)
          }
          break
          
        case TokenType.TABLE:
          if (token.attributes?.state === 'start') {
            html += '<table class="wikitable">'
          } else {
            html += '</tr></table>'
          }
          break
          
        case TokenType.TABLE_ROW:
          // Close previous row if exists, start new row
          if (i > 0 && html.includes('<table')) {
            html += '</tr>'
          }
          html += '<tr>'
          break
          
        case TokenType.TABLE_CELL:
          const isHeader = token.attributes?.header === 'true'
          const cellTag = isHeader ? 'th' : 'td'
          html += `<${cellTag}>${this.processInline(token.text)}</${cellTag}>`
          break
          
        case TokenType.LIST_ITEM:
          // Group consecutive list items of the same type
          const currentType = token.attributes?.type || 'bullet'
          const listType = currentType === 'number' ? 'ol' : 'ul'
          html += `<${listType}>`
          
          while (i < tokens.length) {
            // Skip newlines between list items
            if (tokens[i].type === TokenType.NEWLINE) {
              i++
              continue
            }
            
            // Check if this is still a list item of the same type
            if (tokens[i].type !== TokenType.LIST_ITEM || 
                tokens[i].attributes?.type !== currentType) {
              break
            }
            
            const itemLevel = parseInt(tokens[i].attributes?.level || '1')
            if (itemLevel > 1) {
              // Nested list - start a new nested list
              html += '<li>'
              const nestedType = tokens[i].attributes?.type === 'number' ? 'ol' : 'ul'
              html += `<${nestedType}>`
              html += `<li>${this.processInline(tokens[i].text)}</li>`
              html += `</${nestedType}>`
              html += '</li>'
            } else {
              html += this.renderListItem(tokens[i])
            }
            i++
          }
          html += `</${listType}>`
          continue
      }
      
      i++
    }
    
    return html
  }
  
  /**
   * Process inline wiki syntax within text
   */
  private processInline(text: string): string {
    // First handle bold and italic (before escaping)
    // Bold + Italic (5 quotes) - must come first
    text = text.replace(/'''''(.*?)'''''/g, '<strong><em>$1</em></strong>')
    // Bold (3 quotes)
    text = text.replace(/'''(.*?)'''/g, '<strong>$1</strong>')
    // Italic (2 quotes)
    text = text.replace(/''(.*?)''/g, '<em>$1</em>')
    
    // Handle internal links [[target|display]] or [[target]]
    text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, display) => {
      const linkTarget = target.trim()
      const linkDisplay = display ? display.trim() : linkTarget
      
      // Skip category links
      if (linkTarget.toLowerCase().startsWith('category:')) {
        return ''
      }
      
      // Handle file/image links
      if (linkTarget.toLowerCase().startsWith('file:') || linkTarget.toLowerCase().startsWith('image:')) {
        return match // Let the file tokenizer handle these
      }
      
      // Convert to slug format
      const slug = linkTarget.replace(/ /g, '_')
      return `<a href="/wiki/${slug}">${linkDisplay}</a>`
    })
    
    // Handle external links [url text] or [url]
    text = text.replace(/\[((https?|ftp|mailto):\/\/[^\s\]]+)(?:\s+([^\]]+))?\]/g, (match, url, protocol, text) => {
      const linkText = text ? text.trim() : url
      return `<a href="${url}" rel="nofollow" class="external">${linkText}</a>`
    })
    
    return text
  }
  
  /**
   * Expand a template token
   */
  private expandTemplate(token: Token): string {
    if (this.context.recursionDepth >= (this.options.maxTemplateDepth || 40)) {
      return `<strong class="error">Error: Template recursion depth limit exceeded</strong>`
    }
    
    const name = token.text
    const params = JSON.parse(token.attributes?.params || '[]')
    
    // Convert params array to object
    const templateParams: Record<string, string> = {}
    params.forEach((param: string, index: number) => {
      const equalPos = param.indexOf('=')
      if (equalPos !== -1) {
        const key = param.substring(0, equalPos).trim()
        const value = param.substring(equalPos + 1).trim()
        templateParams[key] = value
      } else {
        templateParams[(index + 1).toString()] = param.trim()
      }
    })
    
    // Check template cache
    const cacheKey = name + JSON.stringify(templateParams)
    if (this.context.templateCache.has(cacheKey)) {
      return this.context.templateCache.get(cacheKey) || ''
    }
    
    // Increment recursion depth
    this.context.recursionDepth++
    
    try {
      // Get template content
      const template = templateRegistry.get(name)
      if (!template) {
        return `<strong class="error">Template not found: ${name}</strong>`
      }
      
      // Create new context for template
      const templateContext = {
        params: templateParams,
        page: this.context.page
      }
      
      // Parse template content
      const result = template.render ? template.render(templateParams, templateContext) : ''
      
      // Cache result
      this.context.templateCache.set(cacheKey, result)
      
      return result
    } finally {
      // Decrement recursion depth
      this.context.recursionDepth--
    }
  }
  
  /**
   * Execute a parser function
   */
  private executeParserFunction(token: Token): string {
    const name = token.text
    const params = JSON.parse(token.attributes?.params || '[]')
    return executeParserFunction(name, params, this.context)
  }
  
  /**
   * Expand a magic word
   */
  private expandMagicWord(token: Token): string {
    const name = token.text
    const value = this.context.magicWords[name]
    
    if (typeof value === 'function') {
      return value()
    }
    
    return value || `<strong class="error">Unknown magic word: ${name}</strong>`
  }
  
  /**
   * Render an internal link
   */
  private renderInternalLink(token: Token): string {
    const target = token.attributes?.target || ''
    const display = token.attributes?.display || target
    
    // Validate target
    if (!target) {
      return token.text || ''
    }
    
    // Check if this is a category link
    if (target.toLowerCase().startsWith('category:')) {
      if (this.options.processCategories) {
        // Store category for later processing
        return ''
      }
      return `[[${target}]]`
    }
    
    // Check if this is a file/image link
    if (target.toLowerCase().startsWith('file:') || target.toLowerCase().startsWith('image:')) {
      const filename = target.substring(target.indexOf(':') + 1).trim()
      // For now, render as a simple link - can be enhanced later for image display
      const href = `/wiki/${encodeURIComponent(target.replace(/\s+/g, '_'))}`
      return `<a href="${href}" class="internal-link file-link">${this.processInline(display)}</a>`
    }
    
    // Normal internal link
    const href = `/wiki/${encodeURIComponent(target.replace(/\s+/g, '_'))}`
    return `<a href="${href}" class="internal-link">${this.processInline(display)}</a>`
  }
  
  /**
   * Render an external link
   */
  private renderExternalLink(token: Token): string {
    const url = token.attributes?.url || ''
    const text = token.text || url
    
    // Validate URL
    if (!url) {
      return token.text || ''
    }
    
    // Escape HTML in URL to prevent XSS
    const safeUrl = url.replace(/"/g, '&quot;')
    
    return `<a href="${safeUrl}" rel="nofollow noopener" target="_blank" class="external-link">${this.processInline(text)}</a>`
  }
  
  /**
   * Render an HTML token
   */
  private renderHTML(token: Token): string {
    const tag = token.text
    const isClosing = token.attributes?.closing === 'true'
    
    if (isClosing) {
      return `</${tag}>`
    }
    
    const attributes = { ...token.attributes }
    delete attributes.closing
    
    const attrString = Object.entries(attributes)
      .map(([key, value]) => `${key}="${value}"`)
      .join(' ')
    
    return `<${tag}${attrString ? ' ' + attrString : ''}>`
  }
  
  /**
   * Render a list item
   */
  private renderListItem(token: Token): string {
    const type = token.attributes?.type || 'bullet'
    const content = this.processInline(token.text)
    
    switch (type) {
      case 'bullet':
        return `<li>${content}</li>`
      case 'number':
        return `<li>${content}</li>`
      case 'indent':
        return `<dd>${content}</dd>`
      case 'definition':
        const parts = content.split(':')
        if (parts.length > 1) {
          return `<dt>${parts[0]}</dt><dd>${parts.slice(1).join(':')}</dd>`
        }
        return `<dt>${content}</dt>`
      default:
        return `<li>${content}</li>`
    }
  }
  
  /**
   * Generate an ID for a heading
   */
  private generateHeadingId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
  }
  
  /**
   * Escape HTML special characters
   */
  /**
   * Get dependencies from tokens
   */
  private getDependencies(tokens: Token[]): string[] {
    const dependencies: Set<string> = new Set()
    
    for (const token of tokens) {
      switch (token.type) {
        case TokenType.TEMPLATE:
          dependencies.add(token.text) // Template name
          break
          
        case TokenType.LINK:
          if (!token.attributes?.external) {
            dependencies.add(token.attributes?.target || token.text) // Page slug
          }
          break
      }
      
      // Check children recursively
      if (token.children) {
        const childDeps = this.getDependencies(token.children)
        childDeps.forEach(dep => dependencies.add(dep))
      }
    }
    
    return Array.from(dependencies)
  }
  
  /**
   * Escape HTML special characters
   */
  private escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}
