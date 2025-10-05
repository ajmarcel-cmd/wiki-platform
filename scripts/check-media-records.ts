/**
 * Check what media records exist in the database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking media records...')

  const media = await prisma.media.findMany({
    where: { 
      filename: { contains: 'wiki-logo' } 
    },
    include: { 
      revisions: { 
        orderBy: { versionNumber: 'desc' } 
      } 
    },
  })

  console.log(`\n📊 Found ${media.length} media records:`)
  
  media.forEach(m => {
    console.log(`\n📁 ${m.filename}`)
    console.log(`   Current version: ${m.currentVersion}`)
    console.log(`   Current URL: ${m.url}`)
    console.log(`   Total revisions: ${m.revisions.length}`)
    
    m.revisions.forEach(r => {
      console.log(`   - v${r.versionNumber}: ${r.url} (${r.comment || 'No comment'})`)
    })
  })

  console.log(`\n🌐 File page URLs that should work:`)
  media.forEach(m => {
    console.log(`   - http://localhost:3001/file/${encodeURIComponent(m.filename)}`)
  })
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
