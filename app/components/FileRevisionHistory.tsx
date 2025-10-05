'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FileRevision {
  id: string
  versionNumber: number
  uploadedAt: string
  uploadedBy?: {
    displayName: string
    isAdmin: boolean
  }
  byteSize: number
  width?: number
  height?: number
  url?: string
  comment?: string
}

interface FileRevisionHistoryProps {
  revisions: FileRevision[]
  currentVersion: number
}

export default function FileRevisionHistory({ revisions, currentVersion }: FileRevisionHistoryProps) {
  const [selectedRevisions, setSelectedRevisions] = useState<string[]>([])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const handleRevisionSelect = (revisionId: string) => {
    setSelectedRevisions(prev => {
      if (prev.includes(revisionId)) {
        return prev.filter(id => id !== revisionId)
      }
      if (prev.length < 2) {
        return [...prev, revisionId]
      }
      return [prev[1], revisionId]
    })
  }

  return (
    <div className="space-y-4">
      {/* Compare button */}
      {selectedRevisions.length === 2 && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700">
              Compare selected versions:
              <br />
              {selectedRevisions.map(id => {
                const rev = revisions.find(r => r.id === id)
                return rev ? `v${rev.versionNumber}` : ''
              }).join(' → ')}
            </span>
            <Link
              href={`/wiki/File:${encodeURIComponent(filename)}/compare/${selectedRevisions.join('/')}`}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Compare versions
            </Link>
          </div>
        </div>
      )}

      {/* Revision list */}
      <div className="space-y-4">
        {revisions.map((revision, index) => (
          <div 
            key={revision.id} 
            className={`p-4 rounded-lg border-l-4 ${
              revision.versionNumber === currentVersion
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Selection checkbox */}
              <div className="pt-1">
                <input
                  type="checkbox"
                  checked={selectedRevisions.includes(revision.id)}
                  onChange={() => handleRevisionSelect(revision.id)}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
              </div>

              {/* Revision details */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-lg">Version {revision.versionNumber}</span>
                  {revision.versionNumber === currentVersion && (
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
                    <span className="font-medium">Date:</span>{' '}
                    {new Date(revision.uploadedAt).toLocaleString()}
                  </div>
                  
                  <div>
                    <span className="font-medium">Size:</span> {formatFileSize(revision.byteSize)}
                    {index > 0 && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({revision.byteSize > revisions[index - 1].byteSize ? '+' : ''}
                        {formatFileSize(revision.byteSize - revisions[index - 1].byteSize)} from previous)
                      </span>
                    )}
                  </div>
                  
                  {revision.width && revision.height && (
                    <div>
                      <span className="font-medium">Dimensions:</span>{' '}
                      {revision.width} × {revision.height}px
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
              
              {/* Actions */}
              <div className="flex flex-col gap-2">
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
                {revision.versionNumber !== currentVersion && (
                  <button
                    className="text-xs px-3 py-1 border rounded hover:bg-gray-100 text-center whitespace-nowrap"
                    onClick={() => {
                      // TODO: Implement restore version functionality
                      alert('Restore functionality coming soon')
                    }}
                  >
                    Restore this version
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
