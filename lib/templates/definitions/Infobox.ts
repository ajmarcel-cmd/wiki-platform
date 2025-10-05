/**
 * Infobox Template Definition
 * Based on Wikipedia's Infobox template
 * 
 * This is a meta-template for creating infoboxes with extensive customization options
 * including titles, images, headers, labels, data rows, styling, and more.
 */

import { TemplateDefinition } from '../registry'
import { TemplateContext } from '../engine'

interface InfoboxRow {
  type: 'header' | 'label-data' | 'data-only'
  header?: string
  label?: string
  data?: string
  number: number
  rowClass?: string
  class?: string
  headerStyle?: string
  labelStyle?: string
  dataStyle?: string
}

interface InfoboxImage {
  src: string
  caption?: string
  style?: string
  captionStyle?: string
}

/**
 * Infobox template structure
 * Generates HTML infobox from template parameters
 */
export const InfoboxTemplate: TemplateDefinition = {
  name: 'Infobox',
  render: (params: Record<string, string>, context: TemplateContext): string => {
    // Helper function to get parameter with default
    const p = (key: string, defaultValue: string = '') => {
      return params[key] || defaultValue
    }

    // Control parameters
    const name = p('name')
    const child = p('child') === 'yes'
    const subbox = p('subbox') === 'yes'
    const decat = p('decat') === 'yes'
    const autoHeaders = p('autoheaders') !== ''
    const italicTitle = p('italic title', 'no')

    // Title parameters
    const title = p('title')
    const above = p('above')
    const subheader = p('subheader')
    const subheader2 = p('subheader2')

    // Image parameters
    const image = p('image')
    const caption = p('caption')
    const image2 = p('image2')
    const caption2 = p('caption2')

    // Style parameters
    const bodyStyle = p('bodystyle')
    const titleStyle = p('titlestyle')
    const aboveStyle = p('abovestyle')
    const subheaderStyle = p('subheaderstyle')
    const subheaderStyle2 = p('subheaderstyle2')
    const imageStyle = p('imagestyle')
    const captionStyle = p('captionstyle')
    const headerStyle = p('headerstyle')
    const labelStyle = p('labelstyle')
    const dataStyle = p('datastyle')
    const belowStyle = p('belowstyle')

    // Class parameters
    const bodyClass = p('bodyclass')
    const titleClass = p('titleclass')
    const aboveClass = p('aboveclass')
    const subheaderClass = p('subheaderclass')
    const subheaderClass2 = p('subheaderclass2')
    const imageClass = p('imageclass')
    const rowClass = p('rowclass')
    const belowClass = p('belowclass')

    // Footer
    const below = p('below')

    // Build rows array
    const rows: InfoboxRow[] = []
    const images: InfoboxImage[] = []

    // Process images
    if (image) {
      images.push({
        src: image,
        caption: caption,
        style: imageStyle,
        captionStyle: captionStyle
      })
    }
    if (image2) {
      images.push({
        src: image2,
        caption: caption2,
        style: imageStyle,
        captionStyle: captionStyle
      })
    }

    // Process data rows (up to 50 rows)
    for (let i = 1; i <= 50; i++) {
      const header = p(`header${i}`)
      const label = p(`label${i}`)
      const data = p(`data${i}`)
      const rowClassParam = p(`rowclass${i}`)
      const classParam = p(`class${i}`)

      if (header || (label && data) || data) {
        const row: InfoboxRow = {
          type: header ? 'header' : (label && data) ? 'label-data' : 'data-only',
          header,
          label,
          data,
          number: i,
          rowClass: rowClassParam,
          class: classParam,
          headerStyle,
          labelStyle,
          dataStyle
        }
        rows.push(row)
      }
    }

    // Filter out empty headers if autoHeaders is enabled
    const filteredRows = autoHeaders ? filterEmptyHeaders(rows) : rows

    // Build HTML
    let html = ''

    // Title (outside table for accessibility)
    if (title && !child) {
      const titleClasses = ['infobox-title']
      if (titleClass) titleClasses.push(titleClass)
      if (italicTitle === 'yes') titleClasses.push('italic-title')
      
      html += `<div class="${titleClasses.join(' ')}"${titleStyle ? ` style="${titleStyle}"` : ''}>${title}</div>`
    }

    // Main table
    const tableClasses = ['infobox']
    if (child) tableClasses.push('infobox-child')
    if (subbox) tableClasses.push('infobox-subbox')
    if (bodyClass) tableClasses.push(bodyClass)

    html += `<table class="${tableClasses.join(' ')}"${bodyStyle ? ` style="${bodyStyle}"` : ''}>`

    // Above row (if not child)
    if (above && !child) {
      const aboveClasses = ['infobox-above']
      if (aboveClass) aboveClasses.push(aboveClass)
      
      html += `<tr><td class="${aboveClasses.join(' ')}" colspan="2"${aboveStyle ? ` style="${aboveStyle}"` : ''}>${above}</td></tr>`
    }

    // Subheaders
    if (subheader && !child) {
      const subheaderClasses = ['infobox-subheader']
      if (subheaderClass) subheaderClasses.push(subheaderClass)
      
      html += `<tr><td class="${subheaderClasses.join(' ')}" colspan="2"${subheaderStyle ? ` style="${subheaderStyle}"` : ''}>${subheader}</td></tr>`
    }
    if (subheader2 && !child) {
      const subheaderClasses = ['infobox-subheader']
      if (subheaderClass2) subheaderClasses.push(subheaderClass2)
      
      html += `<tr><td class="${subheaderClasses.join(' ')}" colspan="2"${subheaderStyle2 ? ` style="${subheaderStyle2}"` : ''}>${subheader2}</td></tr>`
    }

    // Images
    images.forEach((img, index) => {
      const imageClasses = ['infobox-image']
      if (imageClass) imageClasses.push(imageClass)
      
      html += `<tr><td class="${imageClasses.join(' ')}" colspan="2"${img.style ? ` style="${img.style}"` : ''}>`
      html += `<img src="${img.src}" alt="${img.caption || ''}" />`
      if (img.caption) {
        html += `<div class="infobox-caption"${img.captionStyle ? ` style="${img.captionStyle}"` : ''}>${img.caption}</div>`
      }
      html += `</td></tr>`
    })

    // Data rows
    filteredRows.forEach(row => {
      const rowClasses = ['infobox-row']
      if (row.rowClass) rowClasses.push(row.rowClass)
      if (rowClass) rowClasses.push(rowClass)

      html += `<tr class="${rowClasses.join(' ')}">`

      switch (row.type) {
        case 'header':
          const headerClasses = ['infobox-header']
          if (row.class) headerClasses.push(row.class)
          
          html += `<th class="${headerClasses.join(' ')}" colspan="2"${row.headerStyle ? ` style="${row.headerStyle}"` : ''}>${row.header}</th>`
          break

        case 'label-data':
          const labelClasses = ['infobox-label']
          if (row.class) labelClasses.push(row.class)
          
          html += `<th class="${labelClasses.join(' ')}"${row.labelStyle ? ` style="${row.labelStyle}"` : ''}>${row.label}</th>`
          html += `<td class="infobox-data"${row.dataStyle ? ` style="${row.dataStyle}"` : ''}>${row.data}</td>`
          break

        case 'data-only':
          html += `<td class="infobox-data" colspan="2"${row.dataStyle ? ` style="${row.dataStyle}"` : ''}>${row.data}</td>`
          break
      }

      html += `</tr>`
    })

    // Below row
    if (below) {
      const belowClasses = ['infobox-below']
      if (belowClass) belowClasses.push(belowClass)
      
      html += `<tr><td class="${belowClasses.join(' ')}" colspan="2"${belowStyle ? ` style="${belowStyle}"` : ''}>${below}</td></tr>`
    }

    html += `</table>`

    // Add view/talk/edit links if name is provided
    if (name && !child && !subbox) {
      html += `<div class="infobox-links">`
      html += `<a href="/wiki/Template:${name}">view</a> • `
      html += `<a href="/wiki/Template_talk:${name}">talk</a> • `
      html += `<a href="/wiki/Template:${name}?action=edit">edit</a>`
      html += `</div>`
    }

    return html
  }
}

/**
 * Filter out headers that have no visible data rows following them
 */
function filterEmptyHeaders(rows: InfoboxRow[]): InfoboxRow[] {
  const filtered: InfoboxRow[] = []
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    
    if (row.type === 'header') {
      // Check if there are any visible data rows after this header
      let hasVisibleData = false
      for (let j = i + 1; j < rows.length; j++) {
        const nextRow = rows[j]
        if (nextRow.type === 'header') {
          // Found another header, stop checking
          break
        }
        if (nextRow.type === 'label-data' || nextRow.type === 'data-only') {
          if (nextRow.data && nextRow.data.trim() !== '') {
            hasVisibleData = true
            break
          }
        }
      }
      
      // Only include header if it has visible data or is explicitly marked as _BLANK_
      if (hasVisibleData || row.header === '_BLANK_') {
        if (row.header !== '_BLANK_') {
          filtered.push(row)
        }
      }
    } else {
      // Always include non-header rows
      filtered.push(row)
    }
  }
  
  return filtered
}
