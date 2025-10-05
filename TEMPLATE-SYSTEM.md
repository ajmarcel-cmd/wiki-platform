# Wiki Template System Implementation

## Overview

We've implemented a complete MediaWiki-style template system that allows your wiki to function like Bulbapedia. This system can scale to support hundreds of templates with conditional logic, parameter substitution, and more.

## What Was Built

### Core System Files

1. **`lib/templates/parser.ts`** - Template parsing engine
   - Extracts `{{TemplateName|param=value}}` syntax from content
   - Handles nested templates and positional/named parameters
   - Supports parameter defaults: `{{{param|default}}}`

2. **`lib/templates/engine.ts`** - Conditional logic evaluator
   - `{{#if:test|then|else}}` - Conditional rendering
   - `{{#ifeq:val1|val2|then|else}}` - Equality checks
   - `{{#switch:value|case1=result1|...}}` - Switch statements
   - Parameter substitution with defaults

3. **`lib/templates/registry.ts`** - Template management
   - Central registry for all templates
   - Template lookup and rendering
   - Support for both HTML and React component templates

4. **`lib/templates/definitions/CharInfobox.ts`** - CharInfobox implementation
   - Full implementation of Bulbapedia's CharInfobox template
   - 50+ parameters with conditional rendering
   - Matches MediaWiki structure exactly

5. **`lib/templates/index.ts`** - Entry point
   - Initializes and registers all templates
   - Exports template system API

6. **`lib/markdown.ts`** - Updated to integrate templates
   - Parses templates before markdown processing
   - Renders templates inline in content

## How It Works

### 1. Write Wiki Content with Templates

Instead of hardcoding React components, write pure wiki markup:

```wiki
{{CharInfobox
|color=B8860B
|corecolor=F0E68C
|bordercolor=8B7355
|name=Professor Takao Cozmo
|jname=ソライシ・タカオ博士
|tmname=Dr. Takao Soraishi
|image=Professor_Cozmo.png
|gender=Male
|age=yes
|years=40
|hometown=Fallarbor Town
|region=Hoenn
}}

**Professor Takao Cozmo** is a character in Pokémon games...
```

### 2. Templates Are Parsed and Rendered

The markdown processor:
1. Finds all `{{TemplateName|...}}` calls
2. Looks up the template in the registry
3. Evaluates conditional logic
4. Renders to HTML
5. Inserts into final page output

### 3. Result: Dynamic, Data-Driven Pages

Content editors can now create complex pages with templates without touching React code!

## Example: Before and After

### BEFORE (Hardcoded React)

**File: `app/wiki/professor-cozmo/page.tsx`** (357 lines)
```tsx
export default async function ProfessorCozmoPage() {
  // ... lots of hardcoded data
  
  return (
    <div>
      <CharInfobox
        color="B8860B"
        corecolor="F0E68C"
        bordercolor="8B7355"
        name="Professor Takao Cozmo"
        jname="ソライシ・タカオ博士"
        // ... 40 more hardcoded props
      />
      {/* More hardcoded components */}
    </div>
  )
}
```

### AFTER (Data-Driven Template)

**File: `content/wiki/Professor_Cozmo.md`** (Much cleaner!)
```wiki
{{CharInfobox
|color=B8860B
|corecolor=F0E68C
|name=Professor Takao Cozmo
|jname=ソライシ・タカオ博士
|gender=Male
|age=yes
|years=40
|hometown=Fallarbor Town
|region=Hoenn
|game=yes
|anime=yes
|epnum=AG054
}}

# Professor Takao Cozmo

**Professor Takao Cozmo** is a character...
```

**File: `app/wiki/[slug]/page.tsx`** (Generic, reusable!)
```tsx
export default async function WikiPage({ params }) {
  const page = await getPageBySlug(params.slug)
  const { html } = await renderMarkdown(page.content)
  
  return <WikiContent html={html} />
}
```

## Adding New Templates

### Example: Creating a PokémonInfobox Template

**File: `lib/templates/definitions/PokemonInfobox.ts`**
```typescript
import { TemplateDefinition } from '../registry'

export const PokemonInfoboxTemplate: TemplateDefinition = {
  name: 'PokémonInfobox',
  render: (params) => {
    const name = params.name || 'Unknown'
    const ndex = params.ndex || '000'
    const type1 = params.type1 || 'Normal'
    const type2 = params.type2
    
    let html = `<table class="infobox pokemon-infobox">`
    html += `<tr><th colspan="2">${name}</th></tr>`
    html += `<tr><td>National №</td><td>${ndex}</td></tr>`
    html += `<tr><td>Type</td><td>${type1}`
    if (type2) html += ` / ${type2}`
    html += `</td></tr>`
    html += `</table>`
    
    return html
  }
}
```

**Register it in `lib/templates/index.ts`:**
```typescript
import { PokemonInfoboxTemplate } from './definitions/PokemonInfobox'

export function initializeTemplates() {
  templateRegistry.register(CharInfoboxTemplate)
  templateRegistry.register(PokemonInfoboxTemplate) // Add this
}
```

**Use it in wiki pages:**
```wiki
{{PokémonInfobox
|name=Pikachu
|ndex=025
|type1=Electric
|image=025Pikachu.png
}}
```

## Supported Template Features

### ✅ Implemented

- ✅ Template parsing: `{{TemplateName|param=value}}`
- ✅ Parameter defaults: `{{{param|default}}}`
- ✅ Conditional rendering: `{{#if:test|then|else}}`
- ✅ Equality checks: `{{#ifeq:a|b|then|else}}`
- ✅ Switch statements: `{{#switch:val|case1=result1|...}}`
- ✅ Named parameters: `|name=value`
- ✅ Positional parameters: `|value1|value2`
- ✅ Nested templates (with depth limits)
- ✅ Template registry and lookup
- ✅ HTML output templates
- ✅ React component templates (structure ready)
- ✅ CharInfobox with 50+ parameters

### 🚧 Future Enhancements

- ⏳ Template caching for performance
- ⏳ Template inheritance (extend templates)
- ⏳ Magic words ({{PAGENAME}}, {{CURRENTYEAR}}, etc.)
- ⏳ Parser functions ({{PLURAL}}, {{FORMATNUM}}, etc.)
- ⏳ Template documentation generator
- ⏳ Visual template editor
- ⏳ Template version control
- ⏳ Usage analytics

## Testing Your Templates

### Create a Test Page

```typescript
import { renderMarkdown } from '@/lib/markdown'

const testContent = `
{{CharInfobox
|name=Test Character
|gender=Male
|region=Hoenn
}}

This is a test page.
`

const { html } = await renderMarkdown(testContent)
console.log(html) // See rendered output
```

### Debug Template Registry

```typescript
import { templateRegistry } from '@/lib/templates/registry'

// List all templates
console.log('Available templates:', templateRegistry.list())

// Check specific template
console.log('Has CharInfobox:', templateRegistry.has('CharInfobox'))
```

## Migration Path for Existing Pages

### Step 1: Convert Hardcoded Component to Template

Take your existing hardcoded component usage and convert to template syntax.

### Step 2: Store Content in Database or Files

Move page content from TSX files to:
- Database records (using your existing wiki pages table)
- Markdown files in a `content/` directory

### Step 3: Use Generic Wiki Page Component

Replace specific page components with a generic one that renders any wiki page.

### Step 4: Content Editors Can Now Create Pages

Non-developers can create/edit wiki pages using template syntax!

## Performance Considerations

### Current Implementation
- Templates are parsed on every render
- No caching yet
- Each template call is O(n) where n is template complexity

### Optimization Opportunities
1. **Cache rendered templates** - Store rendered HTML for static content
2. **Pre-compile templates** - Convert templates to functions at build time
3. **Lazy load components** - Dynamic imports for React component templates
4. **Memoize parsing** - Cache parsed template structure

## Scaling to Hundreds of Templates

The system is designed to handle hundreds of templates:

1. **Modular Structure**
   - Each template in its own file
   - Templates loaded on-demand (future optimization)
   - Clear separation of concerns

2. **Registry Pattern**
   - O(1) template lookup
   - Case-insensitive matching
   - Namespace support (future)

3. **Template Organization**
   ```
   lib/templates/definitions/
   ├── characters/
   │   ├── CharInfobox.ts
   │   └── CharacterList.ts
   ├── pokemon/
   │   ├── PokemonInfobox.ts
   │   └── PokemonList.ts
   ├── games/
   │   ├── GameInfobox.ts
   │   └── GameList.ts
   └── ... (organize by category)
   ```

4. **Bulk Registration**
   ```typescript
   import * as characterTemplates from './definitions/characters'
   import * as pokemonTemplates from './definitions/pokemon'
   
   export function initializeTemplates() {
     Object.values(characterTemplates).forEach(t => 
       templateRegistry.register(t)
     )
     Object.values(pokemonTemplates).forEach(t => 
       templateRegistry.register(t)
     )
   }
   ```

## Next Steps

### Immediate
1. ✅ Core template system implemented
2. ✅ CharInfobox template created
3. ✅ Markdown integration complete
4. ⏳ Test CharInfobox on actual wiki page
5. ⏳ Create CSS styles for infobox rendering

### Short Term
1. Create more template definitions:
   - PokémonInfobox
   - MoveInfobox
   - AbilityInfobox
   - ItemInfobox
   - TypeTemplate
2. Add template documentation
3. Create template testing utilities

### Long Term
1. Implement template caching
2. Build visual template editor
3. Add template analytics
4. Create template marketplace (share templates)
5. Support community template contributions

## Questions?

See `lib/templates/README.md` for detailed documentation on creating and using templates.
