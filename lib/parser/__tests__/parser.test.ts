import { Parser } from '../parser'
import { ParserContext } from '../types'

describe('MediaWiki Parser', () => {
  let parser: Parser
  let context: ParserContext
  
  beforeEach(() => {
    parser = new Parser()
    context = {
      page: {
        title: 'Test Page',
        namespace: ''
      },
      templateParams: {},
      recursionDepth: 0,
      expandTemplates: true,
      magicWords: {
        PAGENAME: 'Test Page',
        NAMESPACE: '',
        CURRENTYEAR: '2025'
      },
      templateCache: new Map()
    }
  })
  
  describe('Basic Formatting', () => {
    test('should handle bold text', () => {
      const input = "This is '''bold''' text"
      const expected = 'This is <strong>bold</strong> text'
      expect(parser.parse(input, context)).toBe(expected)
    })
    
    test('should handle italic text', () => {
      const input = "This is ''italic'' text"
      const expected = 'This is <em>italic</em> text'
      expect(parser.parse(input, context)).toBe(expected)
    })
    
    test('should handle bold and italic text', () => {
      const input = "This is '''''bold italic''''' text"
      const expected = 'This is <strong><em>bold italic</em></strong> text'
      expect(parser.parse(input, context)).toBe(expected)
    })
  })
  
  describe('Links', () => {
    test('should handle internal links', () => {
      const input = '[[Main Page]]'
      const expected = '<a href="/wiki/Main_Page">Main Page</a>'
      expect(parser.parse(input, context)).toBe(expected)
    })
    
    test('should handle internal links with display text', () => {
      const input = '[[Main Page|Welcome]]'
      const expected = '<a href="/wiki/Main_Page">Welcome</a>'
      expect(parser.parse(input, context)).toBe(expected)
    })
    
    test('should handle external links', () => {
      const input = '[https://example.com Example]'
      const expected = '<a href="https://example.com" rel="nofollow" class="external">Example</a>'
      expect(parser.parse(input, context)).toBe(expected)
    })
  })
  
  describe('Headings', () => {
    test('should handle headings of different levels', () => {
      const input = '== Level 2 ==\n=== Level 3 ===\n==== Level 4 ===='
      const expected = '<h2 id="level-2">Level 2</h2>\n<h3 id="level-3">Level 3</h3>\n<h4 id="level-4">Level 4</h4>'
      expect(parser.parse(input, context)).toBe(expected)
    })
  })
  
  describe('Lists', () => {
    test('should handle unordered lists', () => {
      const input = '* Item 1\n* Item 2\n** Subitem'
      const expected = '<ul><li>Item 1</li>\n<li>Item 2</li>\n<li><ul><li>Subitem</li></ul></li></ul>'
      expect(parser.parse(input, context)).toBe(expected)
    })
    
    test('should handle ordered lists', () => {
      const input = '# Item 1\n# Item 2\n## Subitem'
      const expected = '<ol><li>Item 1</li>\n<li>Item 2</li>\n<li><ol><li>Subitem</li></ol></li></ol>'
      expect(parser.parse(input, context)).toBe(expected)
    })
  })
  
  describe('Templates', () => {
    test('should handle basic templates', () => {
      const input = '{{Test}}'
      const expected = '<div class="template">Test template content</div>'
      // Mock template registry
      jest.spyOn(templateRegistry, 'get').mockReturnValue({
        render: () => '<div class="template">Test template content</div>'
      })
      expect(parser.parse(input, context)).toBe(expected)
    })
    
    test('should handle templates with parameters', () => {
      const input = '{{Test|param1=value1|param2=value2}}'
      const expected = '<div class="template">Test with value1 and value2</div>'
      // Mock template registry
      jest.spyOn(templateRegistry, 'get').mockReturnValue({
        render: (params) => `<div class="template">Test with ${params.param1} and ${params.param2}</div>`
      })
      expect(parser.parse(input, context)).toBe(expected)
    })
  })
  
  describe('Parser Functions', () => {
    test('should handle #if parser function', () => {
      const input = '{{#if: condition | then | else}}'
      const expected = 'then'
      expect(parser.parse(input, context)).toBe(expected)
    })
    
    test('should handle #ifeq parser function', () => {
      const input = '{{#ifeq: text | text | equal | not equal}}'
      const expected = 'equal'
      expect(parser.parse(input, context)).toBe(expected)
    })
  })
  
  describe('Magic Words', () => {
    test('should handle magic words', () => {
      const input = '{{PAGENAME}}'
      const expected = 'Test Page'
      expect(parser.parse(input, context)).toBe(expected)
    })
    
    test('should handle dynamic magic words', () => {
      const input = '{{CURRENTYEAR}}'
      const expected = '2025'
      expect(parser.parse(input, context)).toBe(expected)
    })
  })
  
  describe('HTML', () => {
    test('should handle allowed HTML', () => {
      const input = '<div class="test">Content</div>'
      const expected = '<div class="test">Content</div>'
      expect(parser.parse(input, context)).toBe(expected)
    })
    
    test('should escape HTML when not allowed', () => {
      parser = new Parser({ allowHTML: false })
      const input = '<div class="test">Content</div>'
      const expected = '&lt;div class="test"&gt;Content&lt;/div&gt;'
      expect(parser.parse(input, context)).toBe(expected)
    })
  })
  
  describe('Categories', () => {
    test('should handle categories when processing enabled', () => {
      const input = '[[Category:Test]]'
      const expected = ''
      expect(parser.parse(input, context)).toBe(expected)
    })
    
    test('should preserve categories when processing disabled', () => {
      parser = new Parser({ processCategories: false })
      const input = '[[Category:Test]]'
      const expected = '[[Category:Test]]'
      expect(parser.parse(input, context)).toBe(expected)
    })
  })
})
