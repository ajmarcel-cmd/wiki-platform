# Wiki Template System

This template system enables MediaWiki-style templates in your wiki, similar to Bulbapedia. It supports conditional logic, parameter substitution, and can scale to hundreds of templates.

## Architecture

The template system consists of four main components:

### 1. Parser (`parser.ts`)
Extracts template calls from wiki markup:
```
{{TemplateName|param1=value1|param2=value2}}
```

### 2. Engine (`engine.ts`)
Evaluates conditional logic:
- `{{#if:test|then|else}}` - Conditional rendering
- `{{#ifeq:val1|val2|then|else}}` - Equality check
- `{{#switch:value|case1=result1|case2=result2|default}}` - Switch statement
- `{{{param|default}}}` - Parameter with default value

### 3. Registry (`registry.ts`)
Central repository for all templates. Provides:
- Template registration
- Template lookup
- Rendering orchestration
- Caching (future feature)

### 4. Template Definitions (`definitions/`)
Individual template implementations

## Creating a New Template

### Simple HTML Template

For simple templates, use the wikitext structure:

```typescript
import { TemplateDefinition, templateRegistry } from '../registry'

const SimpleTemplate: TemplateDefinition = {
  name: 'Notice',
  render: (params) => {
    const message = params.message || 'Notice'
    const type = params.type || 'info'
    
    return `<div class="notice notice-${type}">${message}</div>`
  }
}

templateRegistry.register(SimpleTemplate)
```

Usage in wiki:
```
{{Notice|message=This is important!|type=warning}}
```

### Complex Template with Conditionals

For templates with conditional logic (like CharInfobox):

```typescript
const ComplexTemplate: TemplateDefinition = {
  name: 'MyTemplate',
  render: (params, context) => {
    const name = params.name || 'Default'
    const showDetails = params.details === 'yes'
    
    let html = `<div class="my-template">`
    html += `<h3>${name}</h3>`
    
    if (showDetails) {
      html += `<div class="details">${params.detailText || ''}</div>`
    }
    
    html += `</div>`
    return html
  }
}
```

### React Component Template (Advanced)

For complex interactive templates, use React components:

```typescript
import MyComponent from './MyComponent'

const ReactTemplate: TemplateDefinition = {
  name: 'Interactive',
  component: MyComponent,
  transformParams: (params) => ({
    title: params.title || 'Untitled',
    items: params.items?.split(',') || []
  })
}
```

## CharInfobox Template

The CharInfobox template demonstrates full MediaWiki compatibility:

### MediaWiki Syntax (Bulbapedia)
```wiki
{{CharInfobox
|color=B8860B
|corecolor=F0E68C
|bordercolor=8B7355
|name=Professor Takao Cozmo
|jname=ソライシ・タカオ博士
|tmname=Dr. Takao Soraishi
|image=Professor_Cozmo.png
|size=245px
|caption=Art from the Trading Card Game
|gender=Male
|age=yes
|years=40
|hometown=Fallarbor Town
|region=Hoenn
|game=yes
|generation=Generation III, VI
|games=Ruby, Sapphire, Emerald
|anime=yes
|epnum=AG054
|epname=Fight for the Meteorite!
|enva=Sean Schemmel
|java=Tomohiro Nishimura
}}
```

### Parameters

The template supports 50+ parameters:

**Colors:**
- `color` - Background color
- `corecolor` - Left column color
- `bordercolor` - Border color

**Profile:**
- `name` - Character name
- `jname` - Japanese name
- `tmname` - Romanized name
- `gender` - Gender
- `age` - Set to "yes" to show age
- `years` - Age in years
- `hometown` - Hometown
- `region` - Home region

**Game Info:**
- `game` - Set to "yes" for game characters
- `generation` - Generation appeared
- `games` - List of games

**Anime Info:**
- `anime` - Set to "yes" for anime characters
- `epnum` - Episode code (e.g., "AG054")
- `epname` - Episode name
- `enva` - English voice actor
- `java` - Japanese voice actor

**Trainer Info:**
- `trainerclass` - Trainer class
- `leader` - Set to "yes" for Gym Leaders
- `elite` - Set to "yes" for Elite Four
- `champ` - Set to "yes" for Champions

**And many more...**

## Adding Your Template to the System

1. Create your template definition in `lib/templates/definitions/YourTemplate.ts`
2. Import and register it in `lib/templates/index.ts`:

```typescript
import { YourTemplate } from './definitions/YourTemplate'

export function initializeTemplates() {
  templateRegistry.register(CharInfoboxTemplate)
  templateRegistry.register(YourTemplate) // Add this line
}
```

3. Use it in wiki pages:

```wiki
{{YourTemplate|param1=value1|param2=value2}}
```

## Best Practices

### For Maintainability
1. **One file per template** - Keep templates in separate files
2. **Type your parameters** - Use TypeScript interfaces for parameter shapes
3. **Document parameters** - Add comments explaining each parameter
4. **Provide defaults** - Always have sensible default values

### For Performance
1. **Minimize nesting** - Deep template nesting can slow rendering
2. **Cache when possible** - Consider caching rendered output for static content
3. **Lazy load components** - Use dynamic imports for React components

### For Compatibility
1. **Follow MediaWiki conventions** - Stay close to Bulbapedia's syntax
2. **Support legacy syntax** - Handle old parameter names gracefully
3. **Validate inputs** - Check for required parameters

## Conditional Logic Examples

### Simple If
```typescript
// In template: Show section only if parameter exists
if (params.section) {
  html += `<div>${params.section}</div>`
}
```

### Equality Check
```typescript
// Show different content based on type
if (params.type === 'pokemon') {
  html += '<div class="pokemon-info">...</div>'
} else if (params.type === 'trainer') {
  html += '<div class="trainer-info">...</div>'
}
```

### Switch Statement
```typescript
// Different rendering based on status
switch (params.status) {
  case 'active':
    html += '<span class="badge-active">Active</span>'
    break
  case 'retired':
    html += '<span class="badge-retired">Retired</span>'
    break
  default:
    html += '<span class="badge-unknown">Unknown</span>'
}
```

## Testing Templates

Create a test page to verify your template:

```typescript
// In a test page file
const testContent = `
# Template Test Page

{{YourTemplate
|param1=Test Value
|param2=Another Value
}}
`

const { html } = await renderMarkdown(testContent)
```

## Debugging

Enable template debugging by checking the registry:

```typescript
import { templateRegistry } from './lib/templates/registry'

// List all registered templates
console.log('Registered templates:', templateRegistry.list())

// Check if specific template exists
console.log('Has CharInfobox:', templateRegistry.has('CharInfobox'))
```

## Future Enhancements

Planned features:
- [ ] Template caching for performance
- [ ] Template inheritance (extend other templates)
- [ ] Template documentation auto-generation
- [ ] Visual template editor
- [ ] Template analytics (usage tracking)
- [ ] Version control for templates
- [ ] Template preview in editor

## Migration from Hardcoded Components

If you have existing hardcoded React components (like the old CharInfobox), migrate them:

### Before (Hardcoded in page):
```tsx
<CharInfobox
  color="B8860B"
  corecolor="F0E68C"
  name="Professor Cozmo"
  // ... 40 more props
/>
```

### After (Wiki markup):
```wiki
{{CharInfobox
|color=B8860B
|corecolor=F0E68C
|name=Professor Cozmo
}}
```

This allows content editors to create pages without touching React code!
