import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import FilePageTabs from '@/app/components/FilePageTabs'
import FileRevisionHistory from '@/app/components/FileRevisionHistory'

interface FileHistoryPageProps {
  params: Promise<{
    filename: string
  }>
}

export async function generateMetadata({ params }: FileHistoryPageProps) {
  const { filename } = await params
  const decodedFilename = decodeURIComponent(filename)
  
  const media = await prisma.media.findUnique({
    where: { filename: decodedFilename },
  })
  
  if (!media) {
    return { title: 'File Not Found' }
  }

  return {
    title: `File History: ${media.displayName} - Wiki`,
    description: `Revision history for file ${media.displayName}`,
  }
}

export default async function FileHistoryPage({ params }: FileHistoryPageProps) {
  const { filename } = await params
  const decodedFilename = decodeURIComponent(filename)
  
  const media = await prisma.media.findUnique({
    where: { filename: decodedFilename },
    include: {
      revisions: {
        include: {
          uploadedBy: true,
        },
        orderBy: {
          versionNumber: 'desc',
        },
      },
    },
  })

  if (!media) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">File History: {media.displayName}</h1>
          <FilePageTabs filename={media.filename} />
        </div>

        {/* Revision History */}
        <div className="bg-white rounded-lg border p-6">
          <FileRevisionHistory
            revisions={media.revisions}
            currentVersion={media.currentVersion}
          />
        </div>
      </div>
    </div>
  )
}
