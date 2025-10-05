/**
 * Infobox Computing Device Template Definition
 * Based on Wikipedia/MediaWiki's Infobox computing device template
 * 
 * This template creates infoboxes for computing devices including gaming consoles,
 * peripherals, and other computer hardware with extensive customization options.
 */

import { TemplateDefinition } from '../registry'
import { TemplateContext } from '../engine'

/**
 * InfoboxComputingDevice template structure
 * Generates HTML infobox from template parameters
 */
export const InfoboxComputingDeviceTemplate: TemplateDefinition = {
  name: 'Infobox computing device',
  render: (params: Record<string, string>, context: TemplateContext): string => {
    // Helper function to get parameter with fallback chain
    const p = (keys: string | string[], defaultValue: string = '') => {
      if (typeof keys === 'string') {
        return params[keys] || defaultValue
      }
      // Try each key in order
      for (const key of keys) {
        if (params[key]) return params[key]
      }
      return defaultValue
    }

    // Title (with multiple fallbacks)
    const title = p(['title', 'name', 'Name'], context.page?.title || 'PAGENAMEBASE')

    // Images
    const logo = p(['logo'])
    const logoSize = p(['logo_size'])
    const logoUpright = p(['logo_upright'], '1')
    const logoAlt = p(['logo_alt'])
    const logoCaption = p(['logo_caption', 'logo caption'])

    const image = p(['image', 'Image', 'photo', 'Photo'])
    const imageSize = p(['image_size', 'ImageWidth'])
    const imageUpright = p(['image_upright'], '1')
    const alt = p(['alt'])
    const caption = p(['caption'])

    // Basic information
    const codename = p(['codename'])
    const aka = p(['aka'])
    const developer = p(['developer', 'Developer'])
    const manufacturer = p(['manufacturer'])
    const family = p(['family'])
    const type = p(['type', 'Type'])
    const generation = p(['generation'])

    // Dates and availability
    const releaseDate = p(['release date', 'releasedate', 'first_release_date', 'Released', 'Introduced'])
    const availability = p(['retail availability', 'availability'])
    const lifespan = p(['lifespan'])
    const price = p(['price', 'baseprice', 'Baseprice', 'MSRP'])
    const discontinued = p(['discontinuation_date', 'discontinued', 'Discontinued'])

    // Sales
    const unitsSold = p(['units sold', 'unitssold'])
    const unitsShipped = p(['units shipped', 'unitsshipped'])

    // Technical specifications
    const media = p(['media', 'Media'])
    const os = p(['operatingsystem', 'os', 'OS'])
    const soc = p(['soc', 'SOC', 'system-on-chip', 'System-on-chip'])
    const cpu = p(['cpu', 'CPU', 'processor', 'Processor'])
    const cpuSpeed = p(['CPUspeed'])
    const memory = p(['memory', 'Memory', 'RAM'])
    const ramType = p(['RAMtype'])
    const storage = p(['storage'])
    const memoryCard = p(['memory card'])
    const display = p(['display', 'Display'])
    const graphics = p(['graphics', 'Graphics', 'GPU'])
    const sound = p(['sound', 'Sound'])
    const input = p(['input', 'Input'])
    const controllers = p(['controllers'])
    const camera = p(['camera'])
    const touchpad = p(['touchpad'])
    const connectivity = p(['connectivity', 'Connectivity'])
    const power = p(['power', 'Power'])

    // Software and services
    const platform = p(['platform'])
    const currentFw = p(['currentfw'])
    const onlineService = p(['online service', 'onlineservice', 'service'])

    // Physical specifications
    const dimensions = p(['dimensions', 'Casing'])
    const weight = p(['weight'])

    // Marketing and compatibility
    const marketingTarget = p(['marketing_target', 'marketing target'])
    const topGame = p(['top game', 'topgame'])
    const compatibility = p(['compatibility'])
    const modelNo = p(['model_no'])

    // Related products
    const predecessor = p(['predecessor'])
    const successor = p(['successor'])
    const related = p(['related'])

    // Other
    const website = p(['website', 'Website'])
    const language = p(['language', 'Language'])

    // Build HTML
    let html = `<table class="infobox hproduct vevent" style="float: right; margin: 0 0 1em 1em; border: 1px solid #a2a9b1; background-color: #f8f9fa; width: 22em; max-width: 40%;">`

    // Title row
    if (title) {
      html += `<tr><th colspan="2" class="fn summary" style="text-align: center; font-size: 125%; font-weight: bold; background-color: #dfe6ec;">${title}</th></tr>`
    }

    // Logo
    if (logo) {
      html += `<tr><td colspan="2" style="text-align: center; padding: 0.5em;">`
      html += `<img src="/file/${logo}" alt="${logoAlt || title}" style="max-width: ${logoSize || '220px'}; height: auto;" />`
      if (logoCaption) {
        html += `<br><small>${logoCaption}</small>`
      }
      html += `</td></tr>`
    }

    // Main image
    if (image) {
      html += `<tr><td colspan="2" style="text-align: center; padding: 0.5em;">`
      html += `<img src="/file/${image}" alt="${alt || title}" style="max-width: ${imageSize || '220px'}; height: auto;" />`
      if (caption) {
        html += `<br><small>${caption}</small>`
      }
      html += `</td></tr>`
    }

    // Helper function to add row
    const addRow = (label: string, value: string) => {
      if (value) {
        html += `<tr><th style="text-align: right; padding: 0.2em 0.4em; vertical-align: top; white-space: nowrap;">${label}</th>`
        html += `<td style="padding: 0.2em 0.4em; vertical-align: top;">${value}</td></tr>`
      }
    }

    // Basic information rows
    addRow('Codename', codename)
    addRow('Also known as', aka)
    addRow('Developer', developer)
    addRow('Manufacturer', manufacturer)
    addRow('Product family', family)
    addRow('Type', type)
    addRow('Generation', generation)
    addRow('Release date', releaseDate)
    addRow('Availability', availability)
    addRow('Lifespan', lifespan)
    addRow('Introductory price', price)
    addRow('Discontinued', discontinued)
    addRow('Units sold', unitsSold)
    addRow('Units shipped', unitsShipped)
    addRow('Media', media)

    // Technical specifications
    if (os) {
      addRow('Operating system', os)
    }
    addRow('System on a chip', soc)
    
    // CPU with speed
    if (cpu) {
      const cpuValue = cpuSpeed ? `${cpu} @ ${cpuSpeed}` : cpu
      addRow('CPU', cpuValue)
    }

    // Memory with type
    if (memory) {
      const memoryValue = ramType ? `${memory} (${ramType})` : memory
      addRow('Memory', memoryValue)
    }

    addRow('Storage', storage)
    addRow('Removable storage', memoryCard)
    addRow('Display', display)
    addRow('Graphics', graphics)
    addRow('Sound', sound)
    addRow('Input', input)
    addRow('Controller input', controllers)
    addRow('Camera', camera)
    addRow('Touchpad', touchpad)
    addRow('Connectivity', connectivity)
    addRow('Power', power)

    // Software and services
    addRow('Platform', platform)
    addRow('Current firmware', currentFw)
    addRow('Online services', onlineService)

    // Physical specifications
    addRow('Dimensions', dimensions)
    addRow('Weight', weight)

    // Marketing and compatibility
    addRow('Marketing target', marketingTarget)
    addRow('Best-selling game', topGame)
    
    if (compatibility) {
      html += `<tr><th style="text-align: right; padding: 0.2em 0.4em; vertical-align: top; white-space: nowrap;">Backward<br/>compatibility</th>`
      html += `<td style="padding: 0.2em 0.4em; vertical-align: top;">${compatibility}</td></tr>`
    }

    addRow('Model Number', modelNo)

    // Related products
    addRow('Predecessor', predecessor)
    addRow('Successor', successor)
    addRow('Related', related)

    // Other
    addRow('Website', website)
    addRow('Language', language)

    html += `</table>`

    return html
  }
}

