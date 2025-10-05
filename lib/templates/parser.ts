/**
 * Template Parser
 * Parses MediaWiki-style template syntax from wiki content
 * Supports: {{TemplateName|param1=value1|param2=value2}}
 */

export interface TemplateCall {
  name: string
  params: Record<string, string>
  raw: string
  start: number
  end: number
}

/**
 * Parse template calls from wiki content
 * Handles nested templates and pipe parameters
 */
export function parseTemplateCalls(content: string): TemplateCall[] {
  const templates: TemplateCall[] = []
  let i = 0
  
  while (i < content.length) {
    // Look for template start {{
    if (content[i] === '{' && content[i + 1] === '{') {
      const result = parseTemplate(content, i)
      if (result) {
        templates.push(result)
        i = result.end
      } else {
        i++
      }
    } else {
      i++
    }
  }
  
  return templates
}

/**
 * Parse a single template starting at position
 * Returns null if not a valid template
 */
function parseTemplate(content: string, start: number): TemplateCall | null {
  if (content[start] !== '{' || content[start + 1] !== '{') {
    return null
  }
  
  let i = start + 2
  let depth = 1
  let buffer = ''
  const segments: string[] = []
  
  // Parse until we find matching }}
  while (i < content.length && depth > 0) {
    const char = content[i]
    const nextChar = content[i + 1]
    
    if (char === '{' && nextChar === '{') {
      // Nested template start
      depth++
      buffer += char + nextChar
      i += 2
    } else if (char === '}' && nextChar === '}') {
      // Template end
      depth--
      if (depth === 0) {
        // Template complete
        segments.push(buffer.trim())
        break
      } else {
        buffer += char + nextChar
        i += 2
      }
    } else if (char === '|' && depth === 1) {
      // Parameter separator at top level
      segments.push(buffer.trim())
      buffer = ''
      i++
    } else {
      buffer += char
      i++
    }
  }
  
  if (depth !== 0) {
    // Unclosed template
    return null
  }
  
  // First segment is template name
  const name = segments[0] || ''
  
  // Check if this is a parser function or variable (starts with #)
  if (name.startsWith('#') || name.startsWith(':')) {
    return null
  }
  
  // Parse parameters
  const params: Record<string, string> = {}
  let positionalIndex = 1
  
  for (let j = 1; j < segments.length; j++) {
    const segment = segments[j]
    const equalIndex = segment.indexOf('=')
    
    if (equalIndex !== -1) {
      // Named parameter: key=value
      const key = segment.substring(0, equalIndex).trim()
      const value = segment.substring(equalIndex + 1).trim()
      params[key] = value
    } else {
      // Positional parameter
      params[positionalIndex.toString()] = segment.trim()
      positionalIndex++
    }
  }
  
  return {
    name,
    params,
    raw: content.substring(start, i + 2),
    start,
    end: i + 2
  }
}

/**
 * Extract parameter value from template parameter syntax
 * Handles: {{{param|default}}}
 */
export function extractParameterValue(
  value: string,
  params: Record<string, string>
): string {
  // Match {{{paramName|default}}} or {{{paramName}}}
  const paramRegex = /\{\{\{([^|}]+)(?:\|([^}]*))?\}\}\}/g
  
  return value.replace(paramRegex, (match, paramName, defaultValue) => {
    const param = paramName.trim()
    const hasParam = param in params && params[param] !== ''
    
    if (hasParam) {
      return params[param]
    } else if (defaultValue !== undefined) {
      return defaultValue
    } else {
      return ''
    }
  })
}

/**
 * Replace template calls in content with rendered output
 */
export function replaceTemplateCalls(
  content: string,
  templates: TemplateCall[],
  renderFunction: (template: TemplateCall) => string
): string {
  // Sort templates by position (reverse order to preserve indices)
  const sorted = [...templates].sort((a, b) => b.start - a.start)
  
  let result = content
  for (const template of sorted) {
    const rendered = renderFunction(template)
    result = result.substring(0, template.start) + rendered + result.substring(template.end)
  }
  
  return result
}
