'use client'

interface FileMetadataProps {
  metadata: {
    [key: string]: any
  }
  mimeType: string
  width?: number
  height?: number
  duration?: number
  byteSize: number
  sha1?: string
  uploadedAt: string
  uploadedBy?: {
    displayName: string
    isAdmin: boolean
  }
}

export default function FileMetadata({
  metadata,
  mimeType,
  width,
  height,
  duration,
  byteSize,
  sha1,
  uploadedAt,
  uploadedBy,
}: FileMetadataProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-8">
      {/* Basic Information */}
      <section>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="bg-gray-50 px-4 py-3 rounded-lg">
            <dt className="text-sm font-medium text-gray-500">File Type</dt>
            <dd className="mt-1 text-sm text-gray-900">{mimeType}</dd>
          </div>
          
          {width && height && (
            <div className="bg-gray-50 px-4 py-3 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Dimensions</dt>
              <dd className="mt-1 text-sm text-gray-900">{width} × {height} pixels</dd>
            </div>
          )}
          
          {duration && (
            <div className="bg-gray-50 px-4 py-3 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Duration</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDuration(duration)}</dd>
            </div>
          )}
          
          <div className="bg-gray-50 px-4 py-3 rounded-lg">
            <dt className="text-sm font-medium text-gray-500">File Size</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatFileSize(byteSize)}</dd>
          </div>
          
          {sha1 && (
            <div className="bg-gray-50 px-4 py-3 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">SHA-1</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono break-all">{sha1}</dd>
            </div>
          )}
          
          <div className="bg-gray-50 px-4 py-3 rounded-lg">
            <dt className="text-sm font-medium text-gray-500">Upload Date</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(uploadedAt).toLocaleString()}
            </dd>
          </div>
          
          {uploadedBy && (
            <div className="bg-gray-50 px-4 py-3 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Uploaded By</dt>
              <dd className="mt-1 text-sm text-gray-900 flex items-center gap-2">
                {uploadedBy.displayName}
                {uploadedBy.isAdmin && (
                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">
                    Admin
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Extended Metadata */}
      {Object.keys(metadata).length > 0 && (
        <section>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Extended Metadata</h3>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:p-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                {Object.entries(metadata).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-sm font-medium text-gray-500">{key}</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {typeof value === 'object'
                        ? JSON.stringify(value, null, 2)
                        : String(value)
                      }
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
