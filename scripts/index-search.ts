/**
 * Index all pages in Meilisearch
 * Run this after setting up Meilisearch
 */

import { PrismaClient } from '@prisma/client'
import { initializeSearchIndex, indexPages } from '../lib/search'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Initializing search index...')

  // Initialize Meilisearch index with settings
  await initializeSearchIndex()

  // Fetch all pages with their latest content
  console.log('📚 Fetching pages from database...')
  const pages = await prisma.page.findMany({
    include: {
      namespace: true,
      revisions: {
        orderBy: { revisionNumber: 'desc' },
        take: 1,
      },
      categories: {
        include: {
          category: true,
        },
      },
    },
  })

  console.log(`Found ${pages.length} pages to index`)

  // Prepare documents for indexing
  const documents = pages
    .filter((page) => page.revisions.length > 0)
    .map((page) => ({
      id: page.id,
      slug: page.slug,
      title: page.title,
      displayTitle: page.displayTitle,
      content: page.revisions[0].content,
      namespace: page.namespace.name,
      categories: page.categories.map((pc) => pc.category.name),
      updatedAt: page.updatedAt.getTime(),
      viewCount: page.viewCount,
    }))

  // Index in batches
  const batchSize = 100
  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize)
    await indexPages(batch)
    console.log(`Indexed ${Math.min(i + batchSize, documents.length)}/${documents.length} pages`)
  }

  console.log('✅ Search indexing complete!')
}

main()
  .catch((e) => {
    console.error('Error indexing search:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
