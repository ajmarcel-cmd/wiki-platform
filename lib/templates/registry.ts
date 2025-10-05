/**
 * Template Registry
 * Central registry for managing hundreds of wiki templates
 * Provides template lookup, rendering, and caching
 */

import { TemplateCall } from './parser'
import { evaluateTemplate, TemplateContext } from './engine'
import React from 'react'

export interface TemplateDefinition {
  name: string
  // For simple templates, just provide the wikitext structure
  wikitext?: string
  // For complex templates, provide a React component
  component?: React.ComponentType<any>
  // Transform template params before passing to component
  transformParams?: (params: Record<string, string>) => any
  // Render function for custom logic
  render?: (params: Record<string, string>, context: TemplateContext) => string
}

class TemplateRegistry {
  private templates: Map<string, TemplateDefinition> = new Map()
  private aliases: Map<string, string> = new Map()
  
  /**
   * Register a template
   */
  register(definition: TemplateDefinition) {
    const normalizedName = this.normalizeName(definition.name)
    this.templates.set(normalizedName, definition)
  }
  
  /**
   * Register an alias for a template
   */
  registerAlias(aliasName: string, targetName: string) {
    const normalizedAlias = this.normalizeName(aliasName)
    const normalizedTarget = this.normalizeName(targetName)
    this.aliases.set(normalizedAlias, normalizedTarget)
  }
  
  /**
   * Register multiple templates at once
   */
  registerMany(definitions: TemplateDefinition[]) {
    definitions.forEach(def => this.register(def))
  }
  
  /**
   * Get a template by name (follows aliases)
   */
  get(name: string): TemplateDefinition | undefined {
    const normalizedName = this.normalizeName(name)
    
    // Check if this is an alias
    const targetName = this.aliases.get(normalizedName) || normalizedName
    
    return this.templates.get(targetName)
  }
  
  /**
   * Check if template exists (including aliases)
   */
  has(name: string): boolean {
    const normalizedName = this.normalizeName(name)
    
    // Check if it's an alias
    if (this.aliases.has(normalizedName)) {
      const targetName = this.aliases.get(normalizedName)!
      return this.templates.has(targetName)
    }
    
    return this.templates.has(normalizedName)
  }
  
  /**
   * Render a template call
   */
  render(templateCall: TemplateCall, context?: Partial<TemplateContext>): string {
    const template = this.get(templateCall.name)
    
    if (!template) {
      // Template not found, return placeholder
      return `<div class="error">Template not found: ${templateCall.name}</div>`
    }
    
    const ctx: TemplateContext = {
      params: templateCall.params,
      page: context?.page
    }
    
    // Use custom render function if provided
    if (template.render) {
      return template.render(templateCall.params, ctx)
    }
    
    // Use wikitext template if provided
    if (template.wikitext) {
      return evaluateTemplate(template.wikitext, ctx)
    }
    
    // Use React component if provided
    if (template.component) {
      // Transform params if transformer provided
      const props = template.transformParams 
        ? template.transformParams(templateCall.params)
        : templateCall.params
      
      // Return placeholder for React component (will be replaced in component rendering)
      return `<!--TEMPLATE:${templateCall.name}:${JSON.stringify(props)}-->`
    }
    
    return ''
  }
  
  /**
   * Render multiple template calls
   */
  renderAll(
    templateCalls: TemplateCall[],
    context?: Partial<TemplateContext>
  ): Map<TemplateCall, string> {
    const results = new Map<TemplateCall, string>()
    
    templateCalls.forEach(call => {
      const rendered = this.render(call, context)
      results.set(call, rendered)
    })
    
    return results
  }
  
  /**
   * List all registered templates
   */
  list(): string[] {
    return Array.from(this.templates.keys())
  }
  
  /**
   * Normalize template name for case-insensitive lookup
   */
  private normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, '_')
  }
}

// Singleton instance
export const templateRegistry = new TemplateRegistry()

/**
 * Helper to create simple wikitext templates
 */
export function createWikitextTemplate(
  name: string,
  wikitext: string
): TemplateDefinition {
  return {
    name,
    wikitext
  }
}

/**
 * Helper to create React component templates
 */
export function createComponentTemplate(
  name: string,
  component: React.ComponentType<any>,
  transformParams?: (params: Record<string, string>) => any
): TemplateDefinition {
  return {
    name,
    component,
    transformParams
  }
}
