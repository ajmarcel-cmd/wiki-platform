/**
 * Link Parsing Tests
 * Comprehensive tests for internal and external link parsing
 */

import { Parser } from '../parser'
import { ParserContext } from '../types'

describe('Link Parsing', () => {
  let parser: Parser
  let context: ParserContext

  beforeEach(() => {
    parser = new Parser({
      expandTemplates: false,
      allowHTML: true,
      generateTOC: false,
      processCategories: false
    })
    
    context = {
      page: {
        title: 'Test Page',
        namespace: ''
      },
      templateParams: {},
      recursionDepth: 0,
      expandTemplates: false,
      magicWords: {},
      templateCache: new Map()
    }
  })

  describe('Internal Links', () => {
    test('should parse simple internal link', () => {
      const input = '[[Main Page]]'
      const result = parser.parse(input, context)
      expect(result).toContain('<a href="/wiki/Main_Page"')
      expect(result).toContain('class="internal-link"')
      expect(result).toContain('>Main Page</a>')
    })

    test('should parse internal link with display text', () => {
      const input = '[[Main Page|Home]]'
      const result = parser.parse(input, context)
      expect(result).toContain('<a href="/wiki/Main_Page"')
      expect(result).toContain('>Home</a>')
    })

    test('should parse internal link with spaces', () => {
      const input = '[[Super Mario Bros.]]'
      const result = parser.parse(input, context)
      expect(result).toContain('href="/wiki/Super_Mario_Bros.')
    })

    test('should parse internal link within text', () => {
      const input = 'Visit the [[Main Page]] for more info.'
      const result = parser.parse(input, context)
      expect(result).toContain('<a href="/wiki/Main_Page"')
      expect(result).toContain('Visit the')
      expect(result).toContain('for more info')
    })

    test('should handle multiple links in one line', () => {
      const input = 'See [[Page One]] and [[Page Two]] for details.'
      const result = parser.parse(input, context)
      expect(result).toContain('<a href="/wiki/Page_One"')
      expect(result).toContain('<a href="/wiki/Page_Two"')
    })

    test('should handle link with pipe but no display text', () => {
      const input = '[[Main Page|]]'
      const result = parser.parse(input, context)
      expect(result).toContain('<a href="/wiki/Main_Page"')
      expect(result).toContain('>Main Page</a>')
    })

    test('should treat empty target as invalid', () => {
      const input = '[[|Display Text]]'
      const result = parser.parse(input, context)
      // Should be treated as text, not a link
      expect(result).not.toContain('<a href')
    })

    test('should handle file links', () => {
      const input = '[[File:Example.png|thumb|Example image]]'
      const result = parser.parse(input, context)
      expect(result).toContain('href="/wiki/File:Example.png"')
      expect(result).toContain('class="internal-link file-link"')
    })

    test('should suppress category links', () => {
      const input = '[[Category:Test]]'
      const result = parser.parse(input, context)
      // Category links should not appear in output when processCategories is false
      expect(result).not.toContain('<a')
    })
  })

  describe('External Links', () => {
    test('should parse external link with text', () => {
      const input = '[https://example.com Example Site]'
      const result = parser.parse(input, context)
      expect(result).toContain('<a href="https://example.com"')
      expect(result).toContain('class="external-link"')
      expect(result).toContain('>Example Site</a>')
    })

    test('should parse external link without text', () => {
      const input = '[https://example.com]'
      const result = parser.parse(input, context)
      expect(result).toContain('<a href="https://example.com"')
      expect(result).toContain('>https://example.com</a>')
    })

    test('should add security attributes to external links', () => {
      const input = '[https://example.com Example]'
      const result = parser.parse(input, context)
      expect(result).toContain('rel="nofollow noopener"')
      expect(result).toContain('target="_blank"')
    })

    test('should parse http and https links', () => {
      const input = '[http://example.com HTTP] [https://example.com HTTPS]'
      const result = parser.parse(input, context)
      expect(result).toContain('href="http://example.com"')
      expect(result).toContain('href="https://example.com"')
    })

    test('should parse ftp links', () => {
      const input = '[ftp://files.example.com Download]'
      const result = parser.parse(input, context)
      expect(result).toContain('href="ftp://files.example.com"')
    })

    test('should parse mailto links', () => {
      const input = '[mailto:test@example.com Email]'
      const result = parser.parse(input, context)
      expect(result).toContain('href="mailto:test@example.com"')
    })

    test('should not parse invalid URLs', () => {
      const input = '[not-a-url Text]'
      const result = parser.parse(input, context)
      // Should be treated as text, not a link
      expect(result).not.toContain('class="external-link"')
    })

    test('should handle external link within text', () => {
      const input = 'Visit [https://example.com our site] for more.'
      const result = parser.parse(input, context)
      expect(result).toContain('Visit')
      expect(result).toContain('<a href="https://example.com"')
      expect(result).toContain('for more')
    })
  })

  describe('Mixed Links', () => {
    test('should handle internal and external links together', () => {
      const input = 'See [[Main Page]] and [https://example.com Example] for info.'
      const result = parser.parse(input, context)
      expect(result).toContain('class="internal-link"')
      expect(result).toContain('class="external-link"')
    })

    test('should handle links in list items', () => {
      const input = '* [[Page One]]\n* [https://example.com External]\n* [[Page Two|Custom]]'
      const result = parser.parse(input, context)
      expect(result).toContain('<a href="/wiki/Page_One"')
      expect(result).toContain('<a href="https://example.com"')
      expect(result).toContain('<a href="/wiki/Page_Two"')
    })
  })

  describe('Edge Cases', () => {
    test('should handle unclosed internal link', () => {
      const input = '[[Unclosed link'
      const result = parser.parse(input, context)
      // Should be treated as text
      expect(result).not.toContain('<a href')
    })

    test('should handle unclosed external link', () => {
      const input = '[https://example.com Unclosed'
      const result = parser.parse(input, context)
      // Should be treated as text
      expect(result).not.toContain('class="external-link"')
    })

    test('should handle nested brackets', () => {
      const input = '[[Page with [brackets]]]'
      const result = parser.parse(input, context)
      expect(result).toContain('<a href="/wiki/Page_with_%5Bbrackets%5D"')
    })

    test('should preserve inline formatting in link text', () => {
      const input = "[[Main Page|'''Bold''' Link]]"
      const result = parser.parse(input, context)
      expect(result).toContain('<strong>Bold</strong>')
    })
  })
})

