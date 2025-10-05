/**
 * MediaWiki Parser Functions
 * Implements core parser functions like #if, #switch, etc.
 */

import { ParserContext } from './types'

interface ParserFunction {
  (args: string[], context: ParserContext): string
}

const parserFunctions: Record<string, ParserFunction> = {
  // #if: condition | then | else
  'if': (args, context) => {
    if (args.length < 2) return ''
    const condition = args[0].trim()
    const thenValue = args[1] || ''
    const elseValue = args[2] || ''
    
    // Check if condition is truthy (non-empty and not "0")
    const isTruthy = condition !== '' && condition !== '0'
    return isTruthy ? thenValue : elseValue
  },

  // #ifeq: string1 | string2 | then | else
  'ifeq': (args, context) => {
    if (args.length < 3) return ''
    const str1 = args[0].trim()
    const str2 = args[1].trim()
    const thenValue = args[2] || ''
    const elseValue = args[3] || ''
    
    return str1 === str2 ? thenValue : elseValue
  },

  // #switch: value | case1 = result1 | case2 = result2 | #default = defaultResult
  'switch': (args, context) => {
    if (args.length < 2) return ''
    const value = args[0].trim()
    let defaultResult = ''
    
    // Process cases
    for (let i = 1; i < args.length; i++) {
      const caseArg = args[i].trim()
      const equalPos = caseArg.indexOf('=')
      
      if (equalPos === -1) continue
      
      const caseValue = caseArg.substring(0, equalPos).trim()
      const result = caseArg.substring(equalPos + 1).trim()
      
      if (caseValue === '#default') {
        defaultResult = result
      } else if (caseValue === value) {
        return result
      }
    }
    
    return defaultResult
  },

  // #expr: mathematical expression
  'expr': (args, context) => {
    if (args.length === 0) return ''
    const expr = args[0].trim()
    
    try {
      // Basic expression evaluation - NEEDS MORE SECURITY!
      // TODO: Implement proper expression parser
      return eval(expr).toString()
    } catch (error) {
      return '<strong class="error">Expression error</strong>'
    }
  },

  // #time: format | timestamp?
  'time': (args, context) => {
    if (args.length === 0) return ''
    const format = args[0].trim()
    const timestamp = args[1] ? new Date(args[1]) : new Date()
    
    try {
      return timestamp.toLocaleString(undefined, {
        // Basic implementation - needs more format options
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return '<strong class="error">Time format error</strong>'
    }
  }
}

export function executeParserFunction(
  name: string,
  args: string[],
  context: ParserContext
): string {
  const func = parserFunctions[name]
  if (!func) {
    return `<strong class="error">Unknown parser function: ${name}</strong>`
  }
  
  try {
    return func(args, context)
  } catch (error) {
    console.error(`Error executing parser function ${name}:`, error)
    return `<strong class="error">Parser function error: ${name}</strong>`
  }
}
