/**
 * Parser Types
 * Type definitions for the MediaWiki-style parser
 */

export interface ParserContext {
  // Current page information
  page: {
    title: string
    namespace: string
    id?: number
    revision?: number
  }
  
  // Template parameters
  templateParams: Record<string, string>
  
  // Parser state
  recursionDepth: number
  expandTemplates: boolean
  
  // Magic word values
  magicWords: Record<string, string | (() => string)>
  
  // Cache
  templateCache: Map<string, string>
}

export interface Token {
  type: TokenType
  text: string
  start: number
  end: number
  attributes?: Record<string, string>
  children?: Token[]
}

export enum TokenType {
  TEXT = 'TEXT',
  NEWLINE = 'NEWLINE',
  HEADING = 'HEADING',
  LINK = 'LINK',
  TEMPLATE = 'TEMPLATE',
  PARSER_FUNCTION = 'PARSER_FUNCTION',
  MAGIC_WORD = 'MAGIC_WORD',
  HTML = 'HTML',
  TABLE = 'TABLE',
  TABLE_ROW = 'TABLE_ROW',
  TABLE_CELL = 'TABLE_CELL',
  LIST_ITEM = 'LIST_ITEM',
  DEFINITION_TERM = 'DEFINITION_TERM',
  DEFINITION_DESC = 'DEFINITION_DESC'
}

export interface ParserOptions {
  // Whether to expand templates
  expandTemplates?: boolean
  
  // Maximum template recursion depth
  maxTemplateDepth?: number
  
  // Whether to allow HTML
  allowHTML?: boolean
  
  // Whether to generate TOC
  generateTOC?: boolean
  
  // Whether to process categories
  processCategories?: boolean
  
  // Additional magic words
  magicWords?: Record<string, string | (() => string)>
}
