/**
 * MediaWiki Tokenizer
 * Converts wiki text into a stream of tokens
 */

import { Token, TokenType } from './types'

export class Tokenizer {
  private text: string
  private pos: number
  private tokens: Token[]
  
  constructor(text: string) {
    this.text = text
    this.pos = 0
    this.tokens = []
  }
  
  tokenize(): Token[] {
    while (this.pos < this.text.length) {
      const char = this.text[this.pos]
      
      switch (char) {
        case '=':
          if (this.isStartOfLine()) {
            this.tokenizeHeading()
          } else {
            this.tokenizeText()
          }
          break
          
        case '[':
          if (this.text[this.pos + 1] === '[') {
            this.tokenizeInternalLink()
          } else {
            this.tokenizeExternalLink()
          }
          break
          
        case '{':
          if (this.text[this.pos + 1] === '{') {
            if (this.text[this.pos + 2] === '{') {
              this.tokenizeParameter()
            } else {
              this.tokenizeTemplate()
            }
          } else if (this.text[this.pos + 1] === '|') {
            this.tokenizeTableStart()
          } else {
            this.tokenizeText()
          }
          break
          
        case '<':
          this.tokenizeHTML()
          break
          
        case '|':
          if (this.text[this.pos + 1] === '}') {
            this.tokenizeTableEnd()
          } else if (this.text[this.pos + 1] === '-') {
            this.tokenizeTableRow()
          } else if (this.isTableContext()) {
            this.tokenizeTableCell(false)
          } else {
            this.tokenizeText()
          }
          break
          
        case '!':
          if (this.isTableContext()) {
            this.tokenizeTableCell(true)
          } else {
            this.tokenizeText()
          }
          break
          
        case '-':
          this.tokenizeText()
          break
          
        case '*':
        case '#':
        case ':':
        case ';':
          if (this.isStartOfLine()) {
            this.tokenizeList()
          } else {
            this.tokenizeText()
          }
          break
          
        case '\n':
          this.tokenizeNewline()
          break
          
        default:
          this.tokenizeText()
      }
    }
    
    return this.tokens
  }
  
  private tokenizeHeading() {
    const start = this.pos
    let level = 0
    
    // Count equals signs at start
    while (this.text[this.pos] === '=' && level < 6) {
      level++
      this.pos++
    }
    
    // Find matching equals signs
    let content = ''
    let foundEnd = false
    
    while (this.pos < this.text.length) {
      if (this.text[this.pos] === '=' && this.text.slice(this.pos, this.pos + level) === '='.repeat(level)) {
        foundEnd = true
        this.pos += level
        break
      }
      content += this.text[this.pos]
      this.pos++
    }
    
    if (foundEnd) {
      this.tokens.push({
        type: TokenType.HEADING,
        text: content.trim(),
        start,
        end: this.pos,
        attributes: { level: level.toString() }
      })
    } else {
      // No matching equals signs, treat as text
      this.pos = start
      this.tokenizeText()
    }
  }
  
  private tokenizeInternalLink() {
    const start = this.pos
    this.pos += 2 // Skip [[
    
    let target = ''
    let displayText = ''
    let foundEnd = false
    let pipeSplit = false
    
    while (this.pos < this.text.length) {
      if (this.text[this.pos] === ']' && this.text[this.pos + 1] === ']') {
        foundEnd = true
        this.pos += 2
        break
      }
      
      if (this.text[this.pos] === '|' && !pipeSplit) {
        pipeSplit = true
        this.pos++
        continue
      }
      
      if (pipeSplit) {
        displayText += this.text[this.pos]
      } else {
        target += this.text[this.pos]
      }
      this.pos++
    }
    
    if (foundEnd) {
      // Trim both target and display text
      target = target.trim()
      displayText = displayText.trim()
      
      // If target is empty, this is an invalid link
      if (!target) {
        this.tokens.push({
          type: TokenType.TEXT,
          text: `[[${displayText ? '|' + displayText : ''}]]`,
          start,
          end: this.pos
        })
        return
      }
      
      this.tokens.push({
        type: TokenType.LINK,
        text: pipeSplit && displayText ? displayText : target,
        start,
        end: this.pos,
        attributes: {
          target: target,
          display: pipeSplit && displayText ? displayText : target,
          external: 'false'
        }
      })
    } else {
      // No matching brackets, treat as text
      this.pos = start
      this.tokenizeText()
    }
  }
  
  private tokenizeExternalLink() {
    const start = this.pos
    this.pos++ // Skip [
    
    let url = ''
    let text = ''
    let inText = false
    let foundEnd = false
    
    while (this.pos < this.text.length) {
      if (this.text[this.pos] === ' ' && !inText && url) {
        inText = true
        this.pos++
        continue
      }
      
      if (this.text[this.pos] === ']') {
        foundEnd = true
        this.pos++
        break
      }
      
      if (inText) {
        text += this.text[this.pos]
      } else {
        url += this.text[this.pos]
      }
      
      this.pos++
    }
    
    // Check if this is actually a URL (should start with protocol)
    if (foundEnd && url && /^(https?|ftp|mailto):/.test(url)) {
      text = text.trim()
      this.tokens.push({
        type: TokenType.LINK,
        text: text || url,
        start,
        end: this.pos,
        attributes: {
          url: url,
          external: 'true'
        }
      })
    } else {
      // Not a valid external link, treat as text
      this.pos = start
      this.tokenizeText()
    }
  }
  
  private tokenizeTemplate() {
    const start = this.pos
    this.pos += 2 // Skip {{
    
    let name = ''
    let params: string[] = []
    let currentParam = ''
    let depth = 1
    
    while (this.pos < this.text.length && depth > 0) {
      if (this.text[this.pos] === '{' && this.text[this.pos + 1] === '{') {
        depth++
        currentParam += '{{'
        this.pos += 2
        continue
      }
      
      if (this.text[this.pos] === '}' && this.text[this.pos + 1] === '}') {
        depth--
        if (depth === 0) {
          if (currentParam) params.push(currentParam)
          this.pos += 2
          break
        }
        currentParam += '}}'
        this.pos += 2
        continue
      }
      
      if (this.text[this.pos] === '|' && depth === 1) {
        if (!name) {
          name = currentParam
        } else {
          params.push(currentParam)
        }
        currentParam = ''
        this.pos++
        continue
      }
      
      currentParam += this.text[this.pos]
      this.pos++
    }
    
    if (depth === 0) {
      // Check if this is a parser function
      if (name.startsWith('#')) {
        this.tokens.push({
          type: TokenType.PARSER_FUNCTION,
          text: name.substring(1),
          start,
          end: this.pos,
          attributes: {
            params: JSON.stringify(params)
          }
        })
      }
      // Check if this is a magic word
      else if (name.toUpperCase() === name) {
        this.tokens.push({
          type: TokenType.MAGIC_WORD,
          text: name,
          start,
          end: this.pos,
          attributes: {
            params: JSON.stringify(params)
          }
        })
      }
      // Regular template
      else {
        this.tokens.push({
          type: TokenType.TEMPLATE,
          text: name,
          start,
          end: this.pos,
          attributes: {
            params: JSON.stringify(params)
          }
        })
      }
    } else {
      // Unclosed template, treat as text
      this.pos = start
      this.tokenizeText()
    }
  }
  
  private tokenizeHTML() {
    const start = this.pos
    let tag = ''
    let isClosing = false
    let attributes: Record<string, string> = {}
    
    this.pos++ // Skip <
    
    // Check if it's a closing tag
    if (this.text[this.pos] === '/') {
      isClosing = true
      this.pos++
    }
    
    // Get tag name
    while (this.pos < this.text.length && /[a-zA-Z0-9]/.test(this.text[this.pos])) {
      tag += this.text[this.pos]
      this.pos++
    }
    
    // Parse attributes if not a closing tag
    if (!isClosing) {
      while (this.pos < this.text.length && this.text[this.pos] !== '>') {
        // Skip whitespace
        while (this.pos < this.text.length && /\s/.test(this.text[this.pos])) {
          this.pos++
        }
        
        if (this.text[this.pos] === '>') break
        
        // Get attribute name
        let attrName = ''
        while (this.pos < this.text.length && /[a-zA-Z0-9-]/.test(this.text[this.pos])) {
          attrName += this.text[this.pos]
          this.pos++
        }
        
        // Skip whitespace and =
        while (this.pos < this.text.length && /[\s=]/.test(this.text[this.pos])) {
          this.pos++
        }
        
        // Get attribute value
        let attrValue = ''
        const quote = this.text[this.pos]
        if (quote === '"' || quote === "'") {
          this.pos++
          while (this.pos < this.text.length && this.text[this.pos] !== quote) {
            attrValue += this.text[this.pos]
            this.pos++
          }
          this.pos++ // Skip closing quote
        }
        
        if (attrName) {
          attributes[attrName] = attrValue
        }
      }
    }
    
    // Skip to closing >
    while (this.pos < this.text.length && this.text[this.pos] !== '>') {
      this.pos++
    }
    this.pos++ // Skip >
    
    this.tokens.push({
      type: TokenType.HTML,
      text: tag,
      start,
      end: this.pos,
      attributes: {
        ...attributes,
        closing: isClosing ? 'true' : 'false'
      }
    })
  }
  
  private tokenizeText() {
    const start = this.pos
    let text = ''
    
    while (this.pos < this.text.length) {
      const char = this.text[this.pos]
      if (char === '[' || char === '{' || char === '<' || char === '=' ||
          char === '|' || char === '\n' || char === '*' || char === '#' ||
          char === ':' || char === ';') {
        break
      }
      text += char
      this.pos++
    }
    
    if (text) {
      this.tokens.push({
        type: TokenType.TEXT,
        text,
        start,
        end: this.pos
      })
    }
  }
  
  private tokenizeNewline() {
    const start = this.pos
    this.pos++
    
    this.tokens.push({
      type: TokenType.NEWLINE,
      text: '\n',
      start,
      end: this.pos
    })
  }
  
  private tokenizeList() {
    const start = this.pos
    
    // Count the nesting level (number of consecutive markers)
    let level = 0
    const firstMarker = this.text[this.pos]
    while (this.pos < this.text.length && this.text[this.pos] === firstMarker) {
      level++
      this.pos++
    }
    
    // Skip any whitespace after markers
    while (this.pos < this.text.length && this.text[this.pos] === ' ') {
      this.pos++
    }
    
    let content = ''
    while (this.pos < this.text.length && this.text[this.pos] !== '\n') {
      content += this.text[this.pos]
      this.pos++
    }
    
    const type = firstMarker === '*' ? 'bullet' :
                firstMarker === '#' ? 'number' :
                firstMarker === ':' ? 'indent' :
                'definition'
    
    this.tokens.push({
      type: TokenType.LIST_ITEM,
      text: content.trim(),
      start,
      end: this.pos,
      attributes: { type, level: level.toString() }
    })
  }
  
  private tokenizeTableStart() {
    const start = this.pos
    this.pos += 2 // Skip {|
    
    // Skip attributes on the same line
    while (this.pos < this.text.length && this.text[this.pos] !== '\n') {
      this.pos++
    }
    
    this.tokens.push({
      type: TokenType.TABLE,
      text: 'start',
      start,
      end: this.pos,
      attributes: { state: 'start' }
    })
  }
  
  private tokenizeTableEnd() {
    const start = this.pos
    this.pos += 2 // Skip |}
    
    this.tokens.push({
      type: TokenType.TABLE,
      text: 'end',
      start,
      end: this.pos,
      attributes: { state: 'end' }
    })
  }
  
  private tokenizeTableRow() {
    const start = this.pos
    this.pos += 2 // Skip |-
    
    // Skip attributes on the same line
    while (this.pos < this.text.length && this.text[this.pos] !== '\n') {
      this.pos++
    }
    
    this.tokens.push({
      type: TokenType.TABLE_ROW,
      text: '',
      start,
      end: this.pos
    })
  }
  
  private tokenizeTableCell(isHeader: boolean) {
    const start = this.pos
    this.pos++ // Skip first | or !
    
    // Check if this is a cell separator (|| or !!)
    if ((this.text[this.pos - 1] === '|' && this.text[this.pos] === '|') ||
        (this.text[this.pos - 1] === '!' && this.text[this.pos] === '!')) {
      this.pos++ // Skip the second | or !
    }
    
    // Skip any whitespace
    while (this.pos < this.text.length && this.text[this.pos] === ' ') {
      this.pos++
    }
    
    let content = ''
    // Read until we hit another cell marker, newline, or end of table
    while (this.pos < this.text.length && this.text[this.pos] !== '\n') {
      // Check for cell separator
      if ((this.text[this.pos] === '|' && this.text[this.pos + 1] === '|') ||
          (this.text[this.pos] === '!' && this.text[this.pos + 1] === '!')) {
        break
      }
      content += this.text[this.pos]
      this.pos++
    }
    
    this.tokens.push({
      type: TokenType.TABLE_CELL,
      text: content.trim(),
      start,
      end: this.pos,
      attributes: { header: isHeader ? 'true' : 'false' }
    })
  }
  
  private isTableContext(): boolean {
    // Look back to see if we're in a table
    let depth = 0
    for (let i = this.tokens.length - 1; i >= 0; i--) {
      const token = this.tokens[i]
      if (token.type === TokenType.TABLE) {
        if (token.attributes?.state === 'start') {
          depth++
        } else if (token.attributes?.state === 'end') {
          depth--
        }
      }
    }
    return depth > 0
  }
  
  private isStartOfLine(): boolean {
    // Check if we're at the start of the text or after a newline
    if (this.pos === 0) return true
    if (this.tokens.length === 0) return true
    const lastToken = this.tokens[this.tokens.length - 1]
    return lastToken.type === TokenType.NEWLINE
  }
  
  private tokenizeParameter() {
    // Parameters like {{{1}}} are not implemented yet
    // Just treat as text for now
    this.tokenizeText()
  }
}
