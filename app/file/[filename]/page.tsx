import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/db'

interface FilePageProps {
  params: Promise<{
    filename: string
  }>
}

export async function generateMetadata({ params }: FilePageProps) {
  const { filename } = await params
  const decodedFilename = decodeURIComponent(filename)
  
  // Redirect old /file/[filename] URLs to /wiki/File:[filename]
  if (!decodedFilename.startsWith('File:')) {
    redirect(`/wiki/File:${decodedFilename}`)
  }
  
  // Remove File: prefix for database lookup
  const actualFilename = decodedFilename.replace(/^File:/, '')
  
  const media = await prisma.media.findUnique({
    where: { filename: actualFilename },
  })
  
  if (!media) {
    return { title: 'File Not Found' }
  }

  return {
    title: `File: ${media.displayName} - Wiki`,
    description: media.description || `View file ${media.displayName}`,
  }
}

export default async function FilePage({ params }: FilePageProps) {
  const { filename } = await params
  const decodedFilename = decodeURIComponent(filename)
  
  // Redirect old /file/[filename] URLs to /wiki/File:[filename]
  if (!decodedFilename.startsWith('File:')) {
    redirect(`/wiki/File:${decodedFilename}`)
  }
  
  // Remove File: prefix for database lookup
  const actualFilename = decodedFilename.replace(/^File:/, '')
  
  const media = await prisma.media.findUnique({
    where: { filename: actualFilename },
    include: {
      uploadedBy: true,
      categories: {
        include: {
          category: true,
        },
      },
      usages: {
        include: {
          page: {
            include: {
              namespace: true,
            },
          },
        },
        orderBy: {
          addedAt: 'desc',
        },
      },
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

  const isImage = media.mimeType.startsWith('image/')
  const isVideo = media.mimeType.startsWith('video/')
  const isPdf = media.mimeType === 'application/pdf'

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">File: {media.displayName}</h1>
          <p className="text-gray-600">
            <a href={media.url || '#'} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              View original file
            </a>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Preview */}
          <div className="lg:col-span-2">
            <div className="bg-gray-50 rounded-lg border p-4 mb-6">
              {isImage && (
                <div className="relative w-full" style={{ minHeight: '400px' }}>
                  <Image
                    src={media.url || ''}
                    alt={media.displayName}
                    width={media.width || 800}
                    height={media.height || 600}
                    className="w-full h-auto rounded"
                    style={{ objectFit: 'contain' }}
                  />
                </div>
              )}
              {isVideo && (
                <video controls className="w-full rounded">
                  <source src={media.url || ''} type={media.mimeType} />
                  Your browser does not support the video tag.
                </video>
              )}
              {isPdf && (
                <iframe
                  src={media.url || ''}
                  className="w-full rounded"
                  style={{ height: '600px' }}
                  title={media.displayName}
                />
              )}
              {!isImage && !isVideo && !isPdf && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📄</div>
                  <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                  <a
                    href={media.url || '#'}
                    download
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 inline-block"
                  >
                    Download File
                  </a>
                </div>
              )}
            </div>

            {/* Description */}
            {media.description && (
              <div className="bg-white rounded-lg border p-6 mb-6">
                <h2 className="text-xl font-semibold mb-3">Description</h2>
                <p className="text-gray-700 whitespace-pre-wrap">{media.description}</p>
              </div>
            )}

            {/* Categories */}
            {media.categories.length > 0 && (
              <div className="bg-white rounded-lg border p-6 mb-6">
                <h2 className="text-xl font-semibold mb-3">Categories</h2>
                <div className="flex flex-wrap gap-2">
                  {media.categories.map((mediaCategory) => (
                    <Link
                      key={mediaCategory.category.id}
                      href={`/category/${mediaCategory.category.slug}?type=media`}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors text-sm"
                    >
                      {mediaCategory.category.displayName}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Version History */}
            <div className="bg-white rounded-lg border p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">
                Version History {media.revisions.length > 0 && `(${media.revisions.length} versions)`}
              </h2>
              {media.revisions.length > 0 ? (
                <div className="space-y-4">
                  {media.revisions.map((revision, index) => (
                    <div 
                      key={revision.id} 
                      className={`p-4 rounded-lg border-l-4 ${
                        revision.versionNumber === media.currentVersion
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-300 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-lg">Version {revision.versionNumber}</span>
                            {revision.versionNumber === media.revisions.length && (
                              <span className="text-xs px-2 py-1 bg-green-600 text-white rounded">Current</span>
                            )}
                          </div>
                          
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Uploaded by:</span>
                              <span>{revision.uploadedBy?.displayName || 'Unknown'}</span>
                              {revision.uploadedBy?.isAdmin && (
                                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">Admin</span>
                              )}
                            </div>
                            
                            <div>
                              <span className="font-medium">Date:</span> {new Date(revision.uploadedAt).toLocaleString()}
                            </div>
                            
                            <div>
                              <span className="font-medium">Size:</span> {formatFileSize(revision.byteSize)}
                              {revision.byteSize !== media.byteSize && (
                                <span className="ml-2 text-xs text-gray-500">
                                  ({revision.byteSize > media.byteSize ? '+' : ''}
                                  {formatFileSize(revision.byteSize - media.byteSize)} from current)
                                </span>
                              )}
                            </div>
                            
                            {revision.width && revision.height && (
                              <div>
                                <span className="font-medium">Dimensions:</span> {revision.width} × {revision.height}px
                              </div>
                            )}
                          </div>
                          
                          {revision.comment && (
                            <div className="mt-3 p-3 bg-white rounded border-l-2 border-blue-400">
                              <div className="text-xs font-medium text-gray-500 mb-1">Change Description:</div>
                              <div className="text-sm text-gray-700 italic">"{revision.comment}"</div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2 ml-4">
                          {revision.url && (
                            <a
                              href={revision.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-3 py-1 border rounded hover:bg-gray-100 text-center whitespace-nowrap"
                            >
                              View v{revision.versionNumber}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No version history available.</p>
              )}
            </div>

            {/* Usage */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-xl font-semibold mb-4">
                File Usage {media.usages.length > 0 && `(${media.usages.length})`}
              </h2>
              {media.usages.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    The following pages use this file:
                  </p>
                  {media.usages.map((usage) => (
                    <div key={usage.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded">
                      <div className="text-blue-600 mt-1">📄</div>
                      <div className="flex-1">
                        <Link
                          href={`/wiki/${usage.page.slug}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {usage.page.displayTitle}
                        </Link>
                        {usage.page.namespace.name !== 'Main' && (
                          <span className="text-xs text-gray-500 ml-2">
                            ({usage.page.namespace.displayName})
                          </span>
                        )}
                        {usage.usageContext && (
                          <span className="text-xs text-gray-500 ml-2">• {usage.usageContext}</span>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Added {new Date(usage.addedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">This file is not used in any pages yet.</p>
              )}
            </div>
          </div>

          {/* Sidebar - File Information */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border p-6 sticky top-4">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">File Information</h2>
              
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Filename</dt>
                  <dd className="text-sm break-all">{media.filename}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">File Type</dt>
                  <dd className="text-sm">
                    {media.mimeType}
                    {isImage && ' (Image)'}
                    {isVideo && ' (Video)'}
                    {isPdf && ' (PDF Document)'}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">File Size</dt>
                  <dd className="text-sm">{formatFileSize(media.byteSize)}</dd>
                </div>

                {media.width && media.height && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Dimensions</dt>
                    <dd className="text-sm">{media.width} × {media.height} pixels</dd>
                  </div>
                )}


                <div>
                  <dt className="text-sm font-medium text-gray-500">Current Version</dt>
                  <dd className="text-sm font-semibold text-green-600">
                    v{media.revisions.length > 0 ? media.revisions[0].versionNumber : 1}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Total Versions</dt>
                  <dd className="text-sm">{media.revisions.length}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">First Uploaded</dt>
                  <dd className="text-sm">
                    {new Date(media.uploadedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="text-sm">
                    {media.revisions.length > 0 &&
                      new Date(media.revisions[0].uploadedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                  </dd>
                </div>

                {media.uploadedBy && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Uploaded By</dt>
                    <dd className="text-sm">
                      <span className="font-medium">{media.uploadedBy.displayName}</span>
                      {media.uploadedBy.isAdmin && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                          Admin
                        </span>
                      )}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm font-medium text-gray-500">Used In</dt>
                  <dd className="text-sm">{media.usages.length} page{media.usages.length !== 1 ? 's' : ''}</dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Storage</dt>
                  <dd className="text-xs text-gray-600 break-all">
                    {media.storageKey.split('/').pop()}
                  </dd>
                </div>
              </dl>

              {/* Actions */}
              <div className="mt-6 pt-4 border-t space-y-2">
                <a
                  href={media.url || '#'}
                  download
                  className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Download
                </a>
                <a
                  href={media.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  View Original
                </a>
              </div>

              {/* Embed Code */}
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Embed Code</h3>
                <div className="bg-gray-50 p-2 rounded text-xs font-mono break-all">
                  {isImage
                    ? `![${media.displayName}](/file/${encodeURIComponent(media.filename)})`
                    : `[${media.displayName}](/file/${encodeURIComponent(media.filename)})`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}
