'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface ImagePreviewProps {
  src: string
  alt: string
  filename?: string
  width?: number
  height?: number
  size?: number
  uploadedBy?: string
  uploadedAt?: string
  description?: string
  license?: string
}

export default function ImagePreview({
  src,
  alt,
  filename,
  width,
  height,
  size,
  uploadedBy,
  uploadedAt,
  description,
  license
}: ImagePreviewProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (isOpen) {
      const img = new Image()
      img.src = src
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height })
        setIsLoading(false)
      }
    }
  }, [isOpen, src])

  const handleImageClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsOpen(true)
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`
  }

  const imageElement = (
    <img
      src={src}
      alt={alt}
      className="cursor-pointer hover:opacity-90 transition-opacity"
      onClick={handleImageClick}
    />
  )

  return (
    <>
      {filename ? (
        <Link href={`/wiki/File:${encodeURIComponent(filename)}`}>
          {imageElement}
        </Link>
      ) : (
        imageElement
      )}

      {/* MediaWiki-style Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh] bg-white rounded-lg shadow-xl overflow-hidden">
            {/* Toolbar */}
            <div className="bg-gray-100 border-b px-4 py-2 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                {filename || 'Image Preview'}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Image Container */}
            <div className="relative flex">
              {/* Left Panel - Image */}
              <div className="flex-1 bg-gray-900 flex items-center justify-center min-h-[400px]">
                <img
                  src={src}
                  alt={alt}
                  className="max-w-full max-h-[80vh] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Right Panel - Information */}
              <div className="w-80 bg-white border-l overflow-y-auto max-h-[80vh]">
                <div className="p-4">
                  <h4 className="font-medium text-lg mb-4">{alt}</h4>
                  
                  <dl className="space-y-3 text-sm">
                    {width && height && (
                      <div>
                        <dt className="text-gray-500">Dimensions</dt>
                        <dd>{width} × {height} pixels</dd>
                      </div>
                    )}
                    
                    {size && (
                      <div>
                        <dt className="text-gray-500">File size</dt>
                        <dd>{formatFileSize(size)}</dd>
                      </div>
                    )}
                    
                    {uploadedBy && (
                      <div>
                        <dt className="text-gray-500">Uploaded by</dt>
                        <dd>{uploadedBy}</dd>
                      </div>
                    )}
                    
                    {uploadedAt && (
                      <div>
                        <dt className="text-gray-500">Upload date</dt>
                        <dd>{new Date(uploadedAt).toLocaleDateString()}</dd>
                      </div>
                    )}
                    
                    {license && (
                      <div>
                        <dt className="text-gray-500">License</dt>
                        <dd>{license}</dd>
                      </div>
                    )}
                  </dl>

                  {description && (
                    <div className="mt-4 pt-4 border-t">
                      <h5 className="text-gray-500 text-sm mb-2">Description</h5>
                      <p className="text-sm">{description}</p>
                    </div>
                  )}

                  {filename && (
                    <div className="mt-6 space-y-2">
                      <Link
                        href={`/wiki/File:${encodeURIComponent(filename)}`}
                        className="block w-full text-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        View file page
                      </Link>
                      <a
                        href={src}
                        download
                        className="block w-full text-center px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      >
                        Download
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
