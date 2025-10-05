/**
 * Template System Entry Point
 * Import and register all templates here
 */

import { templateRegistry } from './registry'
import { InfoboxTemplate } from './definitions/Infobox'
import { InfoboxComputingDeviceTemplate } from './definitions/InfoboxComputingDevice'

// Register all templates
export function initializeTemplates() {
  templateRegistry.register(InfoboxTemplate)
  templateRegistry.register(InfoboxComputingDeviceTemplate)
  
  // Register template aliases
  // "Infobox information appliance" is another name for computing devices
  templateRegistry.registerAlias('Infobox information appliance', 'Infobox computing device')
  
  // Add more templates here as they are created
  // templateRegistry.register(CharInfoboxTemplate)
  // templateRegistry.register(PokemonInfoboxTemplate)
  // templateRegistry.register(MoveInfoboxTemplate)
  // etc...
}

// Initialize templates on module load
initializeTemplates()

// Export everything for external use
export * from './parser'
export * from './engine'
export * from './registry'
export { InfoboxTemplate } from './definitions/Infobox'
export { InfoboxComputingDeviceTemplate } from './definitions/InfoboxComputingDevice'
