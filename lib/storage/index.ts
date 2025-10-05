/**
 * Media storage with S3-compatible backend
 * MediaWiki-compatible implementation
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import crypto from 'crypto'

import { prisma } from '../db'
import { getHashedStoragePath, getHashedArchivePath, getHashedThumbPath, getFileSha1, splitMimeType, getMediaType } from './hash-path'
import { extractMetadata } from './metadata'

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

function getS3Client(): S3Client | null {
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
  actorId?: string
  description?: string
}

export interface MediaFile {
  id: string
  filename: string
  url: string
  storageKey: string
  majorMime: string
  minorMime: string
  mediaType: string
  byteSize: number
  width?: number
  height?: number
  bits?: number
  sha1: string
  metadata?: any
}

async function upsertCommentFromDescription(description?: string | null) {
  if (!description || !description.trim()) {
    return null
  }

  const hash = crypto.createHash('sha1').update(description).digest('hex')
  return prisma.comment.upsert({
    where: { hash },
    create: {
      text: description,
      hash,
    },
    update: {},
  })
}

async function resolveUploader(actorId?: string | null): Promise<{ uploaderId: string | null; uploaderName: string | null }> {
  if (!actorId) {
    return { uploaderId: null, uploaderName: null }
  }

  const user = await prisma.user.findUnique({
    where: { id: actorId },
  })

  if (user) {
    return {
      uploaderId: user.id,
      uploaderName: user.displayName || user.username,
    }
  }

  const actor = await prisma.actor.findUnique({
    where: { id: actorId },
    include: {
      user: true,
    },
  })

  if (actor) {
    const uploaderName = actor.user?.displayName || actor.user?.username || actor.name
    return {
      uploaderId: actor.user?.id || actor.userId || null,
      uploaderName,
    }
  }

  return {
    uploaderId: null,
    uploaderName: actorId,
  }
}

/**
 * Ensure local storage directory exists
 */
function ensureLocalStorageDir(path: string): void {
  const fullPath = join(LOCAL_STORAGE_PATH, path)
  if (!existsSync(dirname(fullPath))) {
    mkdirSync(dirname(fullPath), { recursive: true })
  }
}

/**
 * Get local file path
 */
function getLocalFilePath(storageKey: string): string {
  return join(LOCAL_STORAGE_PATH, storageKey)
}

/**
 * Get local file URL
 */
function getLocalFileUrl(storageKey: string): string {
  return `/uploads/${storageKey}`
}

/**
 * Upload file to local storage using MediaWiki-style paths
 */
async function uploadToLocalStorage(options: UploadOptions, isArchive: boolean = false): Promise<MediaFile> {
  try {
    const descriptionComment = await upsertCommentFromDescription(options.description)
    const { uploaderId, uploaderName } = await resolveUploader(options.actorId)

    // Generate storage path
    const storageKey = isArchive
      ? getHashedArchivePath(options.filename, `${Date.now()}!${options.filename}`)
      : getHashedStoragePath(options.filename)
    
    // Ensure storage directory exists
    ensureLocalStorageDir(storageKey)
    
    // Write file
    const filePath = getLocalFilePath(storageKey)
    writeFileSync(filePath, options.buffer)
    
    // Generate URL
    const url = getLocalFileUrl(storageKey)
    
    // Calculate SHA-1
    const sha1 = getFileSha1(options.buffer)
    
    // Split MIME type
    const [majorMime, minorMime] = splitMimeType(options.contentType)
    
    // Get media type
    const mediaType = getMediaType(options.contentType)
    
    // Extract metadata
    const extractedMetadata = await extractMetadata(options.buffer, options.contentType)
    
    // Get dimensions and bits from metadata
    const width = extractedMetadata.width
    const height = extractedMetadata.height
    const bits = extractedMetadata.bits

    // Check if this is a new version of an existing file
    const existingMedia = await prisma.media.findUnique({
      where: { filename: options.filename },
    })

    if (existingMedia) {
      const newVersionNumber = (existingMedia.currentVersion || 1) + 1

      // Move current version to archive
      await prisma.mediaArchive.create({
        data: {
          mediaId: existingMedia.id,
          archiveName: `${Date.now()}!${options.filename}`,
          storageKey: existingMedia.storageKey,
          size: existingMedia.byteSize,
          width: existingMedia.width,
          height: existingMedia.height,
          bits: existingMedia.bits,
          metadata: existingMedia.metadata,
          majorMime: existingMedia.majorMime,
          minorMime: existingMedia.minorMime,
          description: options.description,
          actorId: options.actorId,
          sha1: existingMedia.sha1,
          mediaType: existingMedia.mediaType,
        },
      })

      // Update current version
      const media = await prisma.media.update({
        where: { id: existingMedia.id },
        data: {
          storageKey,
          url,
          byteSize: options.buffer.length,
          width,
          height,
          bits,
          mediaType,
          majorMime,
          minorMime,
          metadata: extractedMetadata,
          sha1,
          uploadedById: uploaderId,
          uploadedByName: uploaderName,
          currentVersion: newVersionNumber,
          descriptionId: descriptionComment?.id ?? existingMedia.descriptionId ?? null,
        },
      })

      return {
        id: media.id,
        filename: media.filename,
        url: media.url || url,
        storageKey: media.storageKey,
        majorMime: media.majorMime,
        minorMime: media.minorMime,
        mediaType: media.mediaType || '',
        byteSize: media.byteSize,
        width: media.width || undefined,
        height: media.height || undefined,
        bits: media.bits || undefined,
        sha1: media.sha1 || '',
        metadata: media.metadata,
      }
    } else {
      // Create new media record
      const media = await prisma.media.create({
        data: {
          filename: options.filename,
          displayName: options.filename,
          storageKey,
          url,
          byteSize: options.buffer.length,
          width,
          height,
          bits,
          mediaType,
          majorMime,
          minorMime,
          metadata: extractedMetadata,
          sha1,
          uploadedById: uploaderId,
          uploadedByName: uploaderName,
          currentVersion: 1,
          descriptionId: descriptionComment?.id ?? null,
        },
      })

      return {
        id: media.id,
        filename: media.filename,
        url: media.url || url,
        storageKey: media.storageKey,
        majorMime: media.majorMime,
        minorMime: media.minorMime,
        mediaType: media.mediaType || '',
        byteSize: media.byteSize,
        width: media.width || undefined,
        height: media.height || undefined,
        bits: media.bits || undefined,
        sha1: media.sha1 || '',
        metadata: media.metadata,
      }
    }
  } catch (error) {
    console.error('Failed to upload file to local storage:', error)
    throw error
  }
}

/**
 * Upload file to S3 using MediaWiki-style paths
 */
async function uploadToS3(options: UploadOptions, isArchive: boolean = false): Promise<MediaFile> {
  const client = getS3Client()
  if (!client) {
    throw new Error('S3 storage not configured')
  }

  try {
    const descriptionComment = await upsertCommentFromDescription(options.description)
    const { uploaderId, uploaderName } = await resolveUploader(options.actorId)

    // Generate storage path
    const storageKey = isArchive
      ? getHashedArchivePath(options.filename, `${Date.now()}!${options.filename}`)
      : getHashedStoragePath(options.filename)
    
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
    
    // Calculate SHA-1
    const sha1 = getFileSha1(options.buffer)
    
    // Split MIME type
    const [majorMime, minorMime] = splitMimeType(options.contentType)
    
    // Get media type
    const mediaType = getMediaType(options.contentType)
    
    // Extract metadata
    const extractedMetadata = await extractMetadata(options.buffer, options.contentType)
    
    // Get dimensions and bits from metadata
    const width = extractedMetadata.width
    const height = extractedMetadata.height
    const bits = extractedMetadata.bits

    // Check if this is a new version of an existing file
    const existingMedia = await prisma.media.findUnique({
      where: { filename: options.filename },
    })

    if (existingMedia) {
      const newVersionNumber = (existingMedia.currentVersion || 1) + 1
      // Move current version to archive
      await prisma.mediaArchive.create({
        data: {
          mediaId: existingMedia.id,
          archiveName: `${Date.now()}!${options.filename}`,
          storageKey: existingMedia.storageKey,
          size: existingMedia.byteSize,
          width: existingMedia.width,
          height: existingMedia.height,
          bits: existingMedia.bits,
          metadata: existingMedia.metadata,
          majorMime: existingMedia.majorMime,
          minorMime: existingMedia.minorMime,
          description: options.description,
          actorId: options.actorId,
          sha1: existingMedia.sha1,
          mediaType: existingMedia.mediaType,
        },
      })

      // Update current version
      const media = await prisma.media.update({
        where: { id: existingMedia.id },
        data: {
          storageKey,
          url,
          byteSize: options.buffer.length,
          width,
          height,
          bits,
          mediaType,
          majorMime,
          minorMime,
          metadata: extractedMetadata,
          sha1,
          uploadedById: uploaderId,
          uploadedByName: uploaderName,
          currentVersion: newVersionNumber,
          descriptionId: descriptionComment?.id ?? existingMedia.descriptionId ?? null,
        },
      })

      return {
        id: media.id,
        filename: media.filename,
        url: media.url || url,
        storageKey: media.storageKey,
        majorMime: media.majorMime,
        minorMime: media.minorMime,
        mediaType: media.mediaType || '',
        byteSize: media.byteSize,
        width: media.width || undefined,
        height: media.height || undefined,
        bits: media.bits || undefined,
        sha1: media.sha1 || '',
        metadata: media.metadata,
      }
    } else {
      // Create new media record
      const media = await prisma.media.create({
        data: {
          filename: options.filename,
          displayName: options.filename,
          storageKey,
          url,
          byteSize: options.buffer.length,
          width,
          height,
          bits,
          mediaType,
          majorMime,
          minorMime,
          metadata: extractedMetadata,
          sha1,
          uploadedById: uploaderId,
          uploadedByName: uploaderName,
          currentVersion: 1,
          descriptionId: descriptionComment?.id ?? null,
        },
      })

      return {
        id: media.id,
        filename: media.filename,
        url: media.url || url,
        storageKey: media.storageKey,
        majorMime: media.majorMime,
        minorMime: media.minorMime,
        mediaType: media.mediaType || '',
        byteSize: media.byteSize,
        width: media.width || undefined,
        height: media.height || undefined,
        bits: media.bits || undefined,
        sha1: media.sha1 || '',
        metadata: media.metadata,
      }
    }
  } catch (error) {
    console.error('Failed to upload file:', error)
    throw error
  }
}

/**
 * Upload file to storage
 */
export async function uploadFile(options: UploadOptions): Promise<MediaFile> {
  if (USE_LOCAL_STORAGE) {
    return await uploadToLocalStorage(options)
  }
  return await uploadToS3(options)
}

/**
 * Get file URL (with presigned URL if needed)
 */
export async function getFileUrl(storageKey: string, expiresIn: number = 3600): Promise<string> {
  if (USE_LOCAL_STORAGE) {
    return getLocalFileUrl(storageKey)
  }

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
 * Delete file from storage and database
 */
export async function deleteFile(mediaId: string): Promise<void> {
  try {
    // Get media from database
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      include: {
        archives: true,
      },
    })

    if (!media) {
      throw new Error('Media not found')
    }

    if (USE_LOCAL_STORAGE) {
      // Delete current version
      const filePath = getLocalFilePath(media.storageKey)
      if (existsSync(filePath)) {
        unlinkSync(filePath)
      }

      // Delete archived versions
      for (const archive of media.archives) {
        const archivePath = getLocalFilePath(archive.storageKey)
        if (existsSync(archivePath)) {
          unlinkSync(archivePath)
        }
      }
    } else {
      const client = getS3Client()
      if (!client) {
        throw new Error('S3 storage not configured')
      }

      // Delete current version
      await client.send(
        new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: media.storageKey,
        })
      )

      // Delete archived versions
      for (const archive of media.archives) {
        await client.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET,
            Key: archive.storageKey,
          })
        )
      }
    }

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
  if (USE_LOCAL_STORAGE) {
    const filePath = getLocalFilePath(storageKey)
    if (!existsSync(filePath)) {
      throw new Error('File not found')
    }

    const stats = statSync(filePath)
    return {
      contentLength: stats.size,
      lastModified: stats.mtime,
    }
  }

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
 * Check if storage is available
 */
export async function isStorageAvailable(): Promise<boolean> {
  if (USE_LOCAL_STORAGE) {
    try {
      ensureLocalStorageDir('')
      return true
    } catch (error) {
      console.error('Local storage not available:', error)
      return false
    }
  }
  
  const client = getS3Client()
  if (!client) return false

  try {
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
    url: media.url || await getFileUrl(media.storageKey),
    storageKey: media.storageKey,
    majorMime: media.majorMime,
    minorMime: media.minorMime,
    mediaType: media.mediaType || '',
    byteSize: media.byteSize,
    width: media.width || undefined,
    height: media.height || undefined,
    bits: media.bits || undefined,
    sha1: media.sha1 || '',
    metadata: media.metadata,
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

  return media.map(m => ({
    id: m.id,
    filename: m.filename,
    displayName: m.displayName,
    url: m.url || '',
    majorMime: m.majorMime,
    minorMime: m.minorMime,
    mediaType: m.mediaType || '',
    byteSize: m.byteSize,
    width: m.width || undefined,
    height: m.height || undefined,
    bits: m.bits || undefined,
    sha1: m.sha1 || '',
    metadata: m.metadata,
    uploadedAt: m.uploadedAt,
  }))
}
