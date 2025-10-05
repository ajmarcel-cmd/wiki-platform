/**
 * Built-in MediaWiki Templates
 */

import { wikiTemplateRegistry } from './wiki-registry'

// Infobox template
wikiTemplateRegistry.register({
  name: 'Infobox',
  content: `
<div class="infobox">
  <div class="infobox-header">
    {{{title}}}
  </div>
  <div class="infobox-content">
    {{{content}}}
  </div>
</div>
`,
  description: 'Standard infobox template',
  render: (params, context) => {
    return `
<div class="infobox">
  <div class="infobox-header">
    ${params.title || ''}
  </div>
  <div class="infobox-content">
    ${params.content || ''}
  </div>
</div>
`
  }
})

// Notice template
wikiTemplateRegistry.register({
  name: 'Notice',
  content: `
<div class="notice notice-{{{type}}}">
  {{{content}}}
</div>
`,
  description: 'Display a notice box',
  render: (params, context) => {
    const type = params.type || 'info'
    return `
<div class="notice notice-${type}">
  ${params.content || ''}
</div>
`
  }
})

// Quote template
wikiTemplateRegistry.register({
  name: 'Quote',
  content: `
<blockquote class="wiki-quote">
  {{{text}}}
  {{#if source}}
  <cite>{{{source}}}</cite>
  {{/if}}
</blockquote>
`,
  description: 'Format a quotation',
  render: (params, context) => {
    const source = params.source ? `<cite>${params.source}</cite>` : ''
    return `
<blockquote class="wiki-quote">
  ${params.text || ''}
  ${source}
</blockquote>
`
  }
})

// Gallery template
wikiTemplateRegistry.register({
  name: 'Gallery',
  content: `
<div class="wiki-gallery">
  {{{content}}}
</div>
`,
  description: 'Create an image gallery',
  render: (params, context) => {
    return `
<div class="wiki-gallery">
  ${params.content || ''}
</div>
`
  }
})

// Navigation template
wikiTemplateRegistry.register({
  name: 'Navigation',
  content: `
<nav class="wiki-nav">
  <div class="wiki-nav-header">{{{header}}}</div>
  <div class="wiki-nav-content">
    {{{content}}}
  </div>
</nav>
`,
  description: 'Create a navigation box',
  render: (params, context) => {
    return `
<nav class="wiki-nav">
  <div class="wiki-nav-header">${params.header || ''}</div>
  <div class="wiki-nav-content">
    ${params.content || ''}
  </div>
</nav>
`
  }
})

// Stub template
wikiTemplateRegistry.register({
  name: 'Stub',
  content: `
<div class="wiki-stub">
  This article is a stub. You can help by expanding it.
</div>
`,
  description: 'Mark an article as a stub',
  render: (params, context) => {
    return `
<div class="wiki-stub">
  This article is a stub. You can help by expanding it.
</div>
`
  }
})

// Cite template
wikiTemplateRegistry.register({
  name: 'Cite',
  content: `
<sup class="reference">
  <a href="#cite_note-{{{id}}}">[{{{number}}}]</a>
</sup>
`,
  description: 'Create a citation reference',
  render: (params, context) => {
    return `
<sup class="reference">
  <a href="#cite_note-${params.id || ''}">[${params.number || '?'}]</a>
</sup>
`
  }
})

// References template
wikiTemplateRegistry.register({
  name: 'References',
  content: `
<div class="references">
  <h2>References</h2>
  <ol>
    {{{content}}}
  </ol>
</div>
`,
  description: 'Display references section',
  render: (params, context) => {
    return `
<div class="references">
  <h2>References</h2>
  <ol>
    ${params.content || ''}
  </ol>
</div>
`
  }
})

// Table of contents template
wikiTemplateRegistry.register({
  name: 'TOC',
  content: `
<div class="toc">
  <div class="toc-header">
    Contents
    <span class="toc-toggle">[hide]</span>
  </div>
  <div class="toc-content">
    {{{content}}}
  </div>
</div>
`,
  description: 'Display table of contents',
  render: (params, context) => {
    return `
<div class="toc">
  <div class="toc-header">
    Contents
    <span class="toc-toggle">[hide]</span>
  </div>
  <div class="toc-content">
    ${params.content || ''}
  </div>
</div>
`
  }
})

// Clear template
wikiTemplateRegistry.register({
  name: 'Clear',
  content: '<div style="clear: both;"></div>',
  description: 'Clear floating elements',
  render: () => '<div style="clear: both;"></div>'
})

// Redirect template
wikiTemplateRegistry.register({
  name: 'Redirect',
  content: `
<div class="redirectMsg">
  Redirect to: [[{{{1}}}]]
</div>
`,
  description: 'Show redirect notice',
  render: (params, context) => {
    const target = params['1'] || ''
    return `
<div class="redirectMsg">
  Redirect to: <a href="/wiki/${encodeURIComponent(target.replace(/\s+/g, '_'))}">${target}</a>
</div>
`
  }
})
