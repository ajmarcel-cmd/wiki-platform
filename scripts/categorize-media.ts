#!/usr/bin/env tsx

/**
 * Utility script to categorize media files
 * Usage: npx tsx scripts/categorize-media.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🎯 Media Categorization Utility')
  console.log('================================\n')

  // Get all media files
  const mediaFiles = await prisma.media.findMany({
    include: {
      categories: {
        include: {
          category: true,
        },
      },
    },
    orderBy: {
      uploadedAt: 'desc',
    },
  })

  console.log(`Found ${mediaFiles.length} media files\n`)

  // Get all categories
  const categories = await prisma.category.findMany({
    orderBy: {
      displayName: 'asc',
    },
  })

  console.log('Available categories:')
  categories.forEach((category, index) => {
    console.log(`  ${index + 1}. ${category.displayName} (${category.slug})`)
  })
  console.log()

  // Show uncategorized media
  const uncategorizedMedia = mediaFiles.filter(media => media.categories.length === 0)
  
  if (uncategorizedMedia.length > 0) {
    console.log(`📁 Uncategorized media files (${uncategorizedMedia.length}):`)
    uncategorizedMedia.forEach((media, index) => {
      console.log(`  ${index + 1}. ${media.displayName} (${media.mimeType})`)
    })
    console.log()
  }

  // Show categorized media
  const categorizedMedia = mediaFiles.filter(media => media.categories.length > 0)
  
  if (categorizedMedia.length > 0) {
    console.log(`✅ Categorized media files (${categorizedMedia.length}):`)
    categorizedMedia.forEach((media) => {
      const categoryNames = media.categories.map(mc => mc.category.displayName).join(', ')
      console.log(`  • ${media.displayName} → ${categoryNames}`)
    })
    console.log()
  }

  // Show category statistics
  console.log('📊 Category Statistics:')
  for (const category of categories) {
    const mediaCount = await prisma.mediaCategory.count({
      where: { categoryId: category.id },
    })
    console.log(`  • ${category.displayName}: ${mediaCount} media files`)
  }

  console.log('\n✨ Media categorization overview complete!')
  console.log('\nTo categorize media files:')
  console.log('1. Use the API: POST /api/media/[mediaId]/categories')
  console.log('2. Or use the database directly with MediaCategory model')
  console.log('3. Categories will appear on file pages and category pages')
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
