import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import FilePageTabs from '@/app/components/FilePageTabs'
import FileMetadata from '@/app/components/FileMetadata'

interface FileMetadataPageProps {
  params: Promise<{
    filename: string
  }>
}

export async function generateMetadata({ params }: FileMetadataPageProps) {
  const { filename } = await params
  const decodedFilename = decodeURIComponent(filename)
  
  const media = await prisma.media.findUnique({
    where: { filename: decodedFilename },
  })
  
  if (!media) {
    return { title: 'File Not Found' }
  }

  return {
    title: `File Metadata: ${media.displayName} - Wiki`,
    description: `Technical metadata for file ${media.displayName}`,
  }
}

export default async function FileMetadataPage({ params }: FileMetadataPageProps) {
  const { filename } = await params
  const decodedFilename = decodeURIComponent(filename)
  
  const media = await prisma.media.findUnique({
    where: { filename: decodedFilename },
    include: {
      uploadedBy: true,
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
          <h1 className="text-3xl font-bold mb-2">File Metadata: {media.displayName}</h1>
          <FilePageTabs filename={media.filename} />
        </div>

        {/* Metadata */}
        <div className="bg-white rounded-lg border p-6">
          <FileMetadata
            metadata={media.metadata || {}}
            mimeType={media.mimeType}
            width={media.width}
            height={media.height}
            duration={media.duration}
            byteSize={media.byteSize}
            sha1={media.sha1}
            uploadedAt={media.uploadedAt.toISOString()}
            uploadedBy={media.uploadedBy}
          />
        </div>
      </div>
    </div>
  )
}
