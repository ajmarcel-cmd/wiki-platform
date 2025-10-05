/**
 * Media storage with S3-compatible backend
 * Supports AWS S3, Cloudflare R2, Backblaze B2, MinIO, etc.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs'
import { join, dirname } from 'path'
import { prisma } from './db'

// S3 Configuration
const S3_ENDPOINT = process.env.S3_ENDPOINT // Optional: for R2, B2, MinIO
const S3_REGION = process.env.AWS_REGION || 'us-east-1'
const S3_BUCKET = process.env.AWS_S3_BUCKET || ''
const S3_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || ''
const S3_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || ''
const CDN_URL = process.env.CDN_URL // Optional: CloudFront, R2 public URL, etc.

// Local Storage Configuration
const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || join(process.cwd(), 'uploads')
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true' || (!S3_BUCKET && !S3_ACCESS_KEY)

let s3Client: S3Client | null = null

export function getS3Client(): S3Client | null {
  if (!S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
    console.warn('S3 storage not configured')
    return null
  }

  if (!s3Client) {
    s3Client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
    })
  }

  return s3Client
}

export interface UploadOptions {
  filename: string
  contentType: string
  buffer: Buffer
  metadata?: Record<string, string>
}

export interface MediaFile {
  id: string
  filename: string
  url: string
  storageKey: string
  mimeType: string
  byteSize: number
  width?: number
  height?: number
}

/**
 * Generate unique storage key for file
 */
function generateStorageKey(filename: string): string {
  const hash = crypto.randomBytes(16).toString('hex')
  const ext = filename.split('.').pop()
  const timestamp = Date.now()
  return `media/${timestamp}/${hash}.${ext}`
}

// Local Storage Functions
function ensureLocalStorageDir(): void {
  if (!existsSync(LOCAL_STORAGE_PATH)) {
    mkdirSync(LOCAL_STORAGE_PATH, { recursive: true })
  }
}

function getLocalFilePath(storageKey: string): string {
  return join(LOCAL_STORAGE_PATH, storageKey)
}

function getLocalFileUrl(storageKey: string): string {
  return `/uploads/${storageKey}`
}

/**
 * Upload file to local storage
 */
async function uploadToLocalStorage(options: UploadOptions, storageKey: string): Promise<MediaFile> {
  try {
    // Ensure storage directory exists
    ensureLocalStorageDir()
    
    // Create directory structure
    const filePath = getLocalFilePath(storageKey)
    const dirPath = dirname(filePath)
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true })
    }
    
    // Write file to local storage
    writeFileSync(filePath, options.buffer)
    
    // Generate URL
    const url = getLocalFileUrl(storageKey)
    
    // Get image dimensions if it's an image
    let width: number | undefined
    let height: number | undefined
    if (options.contentType.startsWith('image/')) {
      // For SVG, we can set default dimensions
      if (options.contentType === 'image/svg+xml') {
        width = 200
        height = 200
      }
    }

    // Check if this is a new version of an existing file
    const existingMedia = await prisma.media.findUnique({
      where: { filename: options.filename },
    })

    let media
    if (existingMedia) {
      // This is a new version of an existing file
      const newVersionNumber = (existingMedia.currentVersion || 1) + 1
      
      // Create new revision
      await prisma.mediaRevision.create({
        data: {
          mediaId: existingMedia.id,
          storageKey,
          url,
          byteSize: options.buffer.length,
          width,
          height,
          mimeType: options.contentType,
          versionNumber: newVersionNumber,
          uploadedById: options.metadata?.uploadedBy || null,
          comment: `New version uploaded via API`,
        },
      })

      // Update the main media record
      media = await prisma.media.update({
        where: { id: existingMedia.id },
        data: {
          storageKey,
          url,
          byteSize: options.buffer.length,
          width,
          height,
          mimeType: options.contentType,
          currentVersion: newVersionNumber,
        },
      })

      // Import and trigger content updates
      const { updateMediaReferencesInPages } = await import('./media-updates')
      await updateMediaReferencesInPages(existingMedia.id)
    } else {
      // This is a new file
      media = await prisma.media.create({
        data: {
          filename: options.filename,
          displayName: options.filename,
          mimeType: options.contentType,
          storageKey,
          url,
          byteSize: options.buffer.length,
          width,
          height,
          uploadedById: options.metadata?.uploadedBy || null,
        },
      })
    }

    return {
      id: media.id,
      filename: media.filename,
      url: media.url || url,
      storageKey: media.storageKey,
      mimeType: media.mimeType,
      byteSize: media.byteSize,
      width: media.width || undefined,
      height: media.height || undefined,
    }
  } catch (error) {
    console.error('Failed to upload file to local storage:', error)
    throw error
  }
}

/**
 * Upload file to S3 or local storage
 */
export async function uploadFile(options: UploadOptions): Promise<MediaFile> {
  const storageKey = generateStorageKey(options.filename)
  
  if (USE_LOCAL_STORAGE) {
    return await uploadToLocalStorage(options, storageKey)
  }
  
  const client = getS3Client()
  if (!client) {
    throw new Error('S3 storage not configured')
  }

  try {
    // Upload to S3
    await client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
        Body: options.buffer,
        ContentType: options.contentType,
        Metadata: options.metadata,
      })
    )

    // Generate URL
    const url = CDN_URL
      ? `${CDN_URL}/${storageKey}`
      : await getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: storageKey,
          }),
          { expiresIn: 3600 * 24 * 365 } // 1 year
        )

    // Get image dimensions if it's an image
    let width: number | undefined
    let height: number | undefined
    if (options.contentType.startsWith('image/')) {
      // You could use sharp or another library to get dimensions
      // For now, we'll leave it undefined
    }

    // Check if this is a new version of an existing file
    const existingMedia = await prisma.media.findUnique({
      where: { filename: options.filename },
    })

    let media
    if (existingMedia) {
      // This is a new version of an existing file
      const newVersionNumber = (existingMedia.currentVersion || 1) + 1
      
      // Create new revision
      await prisma.mediaRevision.create({
        data: {
          mediaId: existingMedia.id,
          storageKey,
          url,
          byteSize: options.buffer.length,
          width,
          height,
          mimeType: options.contentType,
          versionNumber: newVersionNumber,
          uploadedById: options.metadata?.uploadedBy || null,
          comment: `New version uploaded via API`,
        },
      })

      // Update the main media record
      media = await prisma.media.update({
        where: { id: existingMedia.id },
        data: {
          storageKey,
          url,
          byteSize: options.buffer.length,
          width,
          height,
          mimeType: options.contentType,
          currentVersion: newVersionNumber,
        },
      })

      // Import and trigger content updates
      const { updateMediaReferencesInPages } = await import('./media-updates')
      await updateMediaReferencesInPages(existingMedia.id)
    } else {
      // This is a new file
      media = await prisma.media.create({
        data: {
          filename: options.filename,
          displayName: options.filename,
          mimeType: options.contentType,
          storageKey,
          url,
          byteSize: options.buffer.length,
          width,
          height,
          uploadedById: options.metadata?.uploadedBy || null,
        },
      })
    }

    return {
      id: media.id,
      filename: media.filename,
      url: media.url || url,
      storageKey: media.storageKey,
      mimeType: media.mimeType,
      byteSize: media.byteSize,
      width: media.width || undefined,
      height: media.height || undefined,
    }
  } catch (error) {
    console.error('Failed to upload file:', error)
    throw error
  }
}

/**
 * Get file URL (with presigned URL if needed)
 */
export async function getFileUrl(storageKey: string, expiresIn: number = 3600): Promise<string> {
  const client = getS3Client()
  if (!client) {
    throw new Error('S3 storage not configured')
  }

  // If CDN is configured, use CDN URL
  if (CDN_URL) {
    return `${CDN_URL}/${storageKey}`
  }

  // Otherwise, generate presigned URL
  try {
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
      }),
      { expiresIn }
    )
    return url
  } catch (error) {
    console.error('Failed to generate file URL:', error)
    throw error
  }
}

/**
 * Delete file from S3 and database
 */
export async function deleteFile(mediaId: string): Promise<void> {
  const client = getS3Client()
  if (!client) {
    throw new Error('S3 storage not configured')
  }

  try {
    // Get media from database
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    })

    if (!media) {
      throw new Error('Media not found')
    }

    // Delete from S3
    await client.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: media.storageKey,
      })
    )

    // Delete from database
    await prisma.media.delete({
      where: { id: mediaId },
    })
  } catch (error) {
    console.error('Failed to delete file:', error)
    throw error
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(storageKey: string) {
  const client = getS3Client()
  if (!client) {
    throw new Error('S3 storage not configured')
  }

  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
      })
    )

    return {
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    }
  } catch (error) {
    console.error('Failed to get file metadata:', error)
    throw error
  }
}

/**
 * Check if storage is available (S3 or local)
 */
export async function isStorageAvailable(): Promise<boolean> {
  if (USE_LOCAL_STORAGE) {
    try {
      // Check if we can create the local storage directory
      ensureLocalStorageDir()
      return true
    } catch (error) {
      console.error('Local storage not available:', error)
      return false
    }
  }
  
  const client = getS3Client()
  if (!client) return false

  try {
    // Try to list objects (with limit 1) to check connectivity
    await client.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: 'test-key-that-probably-doesnt-exist',
      })
    )
    return true
  } catch (error: any) {
    // 404 is fine, it means we can connect
    if (error.name === 'NotFound') return true
    return false
  }
}

/**
 * Get media by filename
 */
export async function getMediaByFilename(filename: string): Promise<MediaFile | null> {
  const media = await prisma.media.findUnique({
    where: { filename },
  })

  if (!media) return null

  return {
    id: media.id,
    filename: media.filename,
    url: media.url || (await getFileUrl(media.storageKey)),
    storageKey: media.storageKey,
    mimeType: media.mimeType,
    byteSize: media.byteSize,
    width: media.width || undefined,
    height: media.height || undefined,
  }
}

/**
 * Get original filename from a URL
 * This is useful when you have a versioned URL but need the original filename
 * for database lookups
 */
export async function getOriginalFilenameFromUrl(url: string): Promise<string | null> {
  try {
    console.log('🔍 Looking up filename for URL:', url)
    
    // First try to find by exact URL match
    const media = await prisma.media.findFirst({
      where: { url },
    })
    
    if (media) {
      console.log('✅ Found exact URL match:', media.filename)
      return media.filename
    }
    
    // If no exact match, try to extract filename from URL and search by that
    // This handles cases where the URL might be a presigned URL or CDN URL
    let pathname: string
    try {
      const urlObj = new URL(url)
      pathname = urlObj.pathname
    } catch (e) {
      // If URL parsing fails, treat the whole string as a pathname
      pathname = url.startsWith('/') ? url : `/${url}`
    }
    
    const parts = pathname.split('/')
    const potentialFilename = parts[parts.length - 1]
    
    console.log('🔍 Extracted potential filename:', potentialFilename)
    
    if (potentialFilename && potentialFilename.includes('.')) {
      // Try to find media by filename
      const mediaByFilename = await prisma.media.findUnique({
        where: { filename: decodeURIComponent(potentialFilename) },
      })
      
      if (mediaByFilename) {
        console.log('✅ Found media by filename:', mediaByFilename.filename)
        return mediaByFilename.filename
      }
      
      // If that didn't work, try to find by URL that contains this filename
      const mediaByUrl = await prisma.media.findFirst({
        where: { 
          url: { contains: potentialFilename }
        },
      })
      
      if (mediaByUrl) {
        console.log('✅ Found media by URL containing filename:', mediaByUrl.filename)
        return mediaByUrl.filename
      }
    }
    
    console.log('❌ No media found for URL:', url)
    return null
  } catch (error) {
    console.error('Error getting original filename from URL:', error)
    return null
  }
}

/**
 * List all media files
 */
export async function listMedia(limit: number = 100, offset: number = 0) {
  const media = await prisma.media.findMany({
    take: limit,
    skip: offset,
    orderBy: { uploadedAt: 'desc' },
  })

  return media.map((m: any) => ({
    id: m.id,
    filename: m.filename,
    displayName: m.displayName,
    url: m.url || '',
    mimeType: m.mimeType,
    byteSize: m.byteSize,
    uploadedAt: m.uploadedAt,
  }))
}
