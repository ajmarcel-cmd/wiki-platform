/**
 * Wiki Template Registry
 * Handles MediaWiki-style templates and transclusion
 */

import { ParserContext } from '../parser/types'
import { prisma } from '../db'

interface WikiTemplate {
  name: string
  content: string
  description?: string
  render: (params: Record<string, string>, context: ParserContext) => string
}

class WikiTemplateRegistry {
  private templates: Map<string, WikiTemplate> = new Map()
  private templateCache: Map<string, string> = new Map()
  
  /**
   * Register a new template
   */
  register(template: WikiTemplate) {
    this.templates.set(template.name.toLowerCase(), template)
    this.templateCache.clear() // Clear cache when templates change
  }
  
  /**
   * Get a template by name
   */
  get(name: string): WikiTemplate | undefined {
    return this.templates.get(name.toLowerCase())
  }
  
  /**
   * Check if a template exists
   */
  has(name: string): boolean {
    return this.templates.has(name.toLowerCase())
  }
  
  /**
   * Remove a template
   */
  remove(name: string) {
    this.templates.delete(name.toLowerCase())
    this.templateCache.clear()
  }
  
  /**
   * Clear all templates
   */
  clear() {
    this.templates.clear()
    this.templateCache.clear()
  }
  
  /**
   * Load templates from database
   */
  async loadFromDatabase() {
    const templates = await prisma.template.findMany()
    
    templates.forEach(template => {
      this.register({
        name: template.name,
        content: template.content,
        description: template.description || undefined,
        render: (params, context) => this.renderTemplate(template.content, params, context)
      })
    })
  }
  
  /**
   * Render a template with parameters
   */
  private renderTemplate(
    content: string,
    params: Record<string, string>,
    context: ParserContext
  ): string {
    // Check cache first
    const cacheKey = content + JSON.stringify(params) + JSON.stringify(context.page)
    const cached = this.templateCache.get(cacheKey)
    if (cached) return cached
    
    // Replace parameter references
    let result = content.replace(/\{\{\{([^}]+)\}\}\}/g, (match, paramName) => {
      const name = paramName.trim()
      return params[name] || ''
    })
    
    // Replace magic words
    result = result.replace(/\{\{([A-Z_]+)\}\}/g, (match, word) => {
      const value = context.magicWords[word]
      if (typeof value === 'function') {
        return value()
      }
      return value || match
    })
    
    // Cache result
    this.templateCache.set(cacheKey, result)
    
    return result
  }
  
  /**
   * Create a new template in the database
   */
  async createTemplate(
    name: string,
    content: string,
    description?: string
  ): Promise<void> {
    await prisma.template.create({
      data: {
        name,
        displayName: name,
        content,
        description
      }
    })
    
    this.register({
      name,
      content,
      description,
      render: (params, context) => this.renderTemplate(content, params, context)
    })
  }
  
  /**
   * Update an existing template
   */
  async updateTemplate(
    name: string,
    content: string,
    description?: string
  ): Promise<void> {
    await prisma.template.update({
      where: { name },
      data: {
        content,
        description
      }
    })
    
    this.register({
      name,
      content,
      description,
      render: (params, context) => this.renderTemplate(content, params, context)
    })
  }
  
  /**
   * Delete a template
   */
  async deleteTemplate(name: string): Promise<void> {
    await prisma.template.delete({
      where: { name }
    })
    
    this.remove(name)
  }
}

// Export singleton instance
export const wikiTemplateRegistry = new WikiTemplateRegistry()
