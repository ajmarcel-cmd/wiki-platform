/**
 * Template Engine
 * Handles template compilation and rendering using Handlebars
 */

import type { TemplateDelegate } from 'handlebars'
import Handlebars from 'handlebars'
import { readFileSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { prisma } from '../db'

export interface TemplateContext {
  params: Record<string, string>
  page?: any
}

interface CompiledTemplate {
  phpCode: string
  files: string[]
  filesHash: string
  integrityHash: string
}

interface TemplateCache {
  [key: string]: {
    template: TemplateDelegate
    hash: string
  }
}

export class TemplateEngine {
  private templateDir: string
  private cache: TemplateCache = {}
  private helpers: Record<string, Handlebars.HelperDelegate> = {}
  
  constructor(templateDir: string) {
    this.templateDir = templateDir
    this.registerDefaultHelpers()
  }
  
  /**
   * Register default template helpers
   */
  private registerDefaultHelpers() {
    // Format date helper
    this.helpers.formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString()
    }
    
    // Pluralize helper
    this.helpers.plural = (count: number, singular: string, plural: string) => {
      return count === 1 ? singular : plural
    }
    
    // If equals helper
    this.helpers.ifeq = function(a: any, b: any, options: Handlebars.HelperOptions) {
      return a === b ? options.fn(this) : options.inverse(this)
    }
    
    // Unless equals helper
    this.helpers.unlesseq = function(a: any, b: any, options: Handlebars.HelperOptions) {
      return a === b ? options.inverse(this) : options.fn(this)
    }
    
    // Register all helpers with Handlebars
    Object.entries(this.helpers).forEach(([name, helper]) => {
      Handlebars.registerHelper(name, helper)
    })
  }
  
  /**
   * Get template from cache or compile it
   */
  private async getTemplate(name: string): Promise<TemplateDelegate> {
    const templatePath = join(this.templateDir, `${name}.hbs`)
    
    try {
      // Get file hash
      const content = readFileSync(templatePath, 'utf-8')
      const hash = createHash('sha256').update(content).digest('hex')
      
      // Check cache
      if (this.cache[name] && this.cache[name].hash === hash) {
        return this.cache[name].template
      }
      
      // Compile template
      const template = Handlebars.compile(content)
      
      // Cache template
      this.cache[name] = {
        template,
        hash
      }
      
      return template
    } catch (error) {
      const err = error as Error
      throw new Error(`Failed to load template ${name}: ${err.message}`)
    }
  }
  
  /**
   * Register a new helper
   */
  registerHelper(name: string, helper: Handlebars.HelperDelegate) {
    this.helpers[name] = helper
    Handlebars.registerHelper(name, helper)
  }
  
  /**
   * Render a template with data
   */
  async render(name: string, data: any = {}): Promise<string> {
    const template = await this.getTemplate(name)
    return template(data)
  }
  
  /**
   * Render a template string directly
   */
  renderString(template: string, data: any = {}): string {
    const compiled = Handlebars.compile(template)
    return compiled(data)
  }
  
  /**
   * Get a list of all templates
   */
  async getTemplates(): Promise<string[]> {
    const templates = await prisma.template.findMany({
      select: {
        name: true
      }
    })
    return templates.map(t => t.name)
  }
  
  /**
   * Check if a template exists
   */
  async templateExists(name: string): Promise<boolean> {
    const template = await prisma.template.findUnique({
      where: { name }
    })
    return !!template
  }
  
  /**
   * Create or update a template
   */
  async saveTemplate(name: string, content: string, description?: string): Promise<void> {
    await prisma.template.upsert({
      where: { name },
      create: {
        name,
        displayName: name,
        content,
        description
      },
      update: {
        content,
        description
      }
    })
    
    // Clear cache for this template
    delete this.cache[name]
  }
  
  /**
   * Delete a template
   */
  async deleteTemplate(name: string): Promise<void> {
    await prisma.template.delete({
      where: { name }
    })
    
    // Clear cache for this template
    delete this.cache[name]
  }
  
  /**
   * Clear the template cache
   */
  clearCache() {
    this.cache = {}
  }
}

/**
 * Evaluate a template string with context
 * This is a simple template evaluator for wikitext templates
 */
export function evaluateTemplate(template: string, context: TemplateContext): string {
  let result = template
  
  // Replace parameter placeholders with actual values
  Object.entries(context.params).forEach(([key, value]) => {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'gi')
    result = result.replace(placeholder, value)
  })
  
  // Handle conditional logic (simple if/else)
  result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
    const param = condition.trim()
    const value = context.params[param]
    return value && value !== '' ? content : ''
  })
  
  // Handle else conditions
  result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{#else\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, ifContent, elseContent) => {
    const param = condition.trim()
    const value = context.params[param]
    return value && value !== '' ? ifContent : elseContent
  })
  
  return result
}