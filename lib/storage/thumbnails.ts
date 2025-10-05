/**
 * MediaWiki-compatible thumbnail generation and caching
 */

import sharp from 'sharp'
import { getHashedThumbPath } from './hash-path'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Configuration
const S3_BUCKET = process.env.AWS_S3_BUCKET || ''
const CDN_URL = process.env.CDN_URL
const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || join(process.cwd(), 'uploads')
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true' || (!S3_BUCKET)

// Thumbnail size presets (like MediaWiki)
export const THUMB_SIZES = {
  small: 120,
  medium: 300,
  large: 800,
  xlarge: 1200,
}

interface ThumbnailOptions {
  width?: number
  height?: number
  mode?: 'resize' | 'crop' | 'fit'
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

interface ThumbnailResult {
  url: string
  width: number
  height: number
  storageKey: string
}

/**
 * Generate thumbnail name based on parameters
 */
function generateThumbName(
  filename: string,
  options: ThumbnailOptions
): string {
  const parts = []
  
  if (options.width) parts.push(`${options.width}px`)
  if (options.height) parts.push(`${options.height}px`)
  if (options.mode) parts.push(options.mode)
  if (options.format) parts.push(options.format)
  
  const suffix = parts.join('-')
  const ext = options.format || filename.split('.').pop()
  
  return `thumb_${suffix}.${ext}`
}

/**
 * Ensure local thumbnail directory exists
 */
function ensureThumbDir(path: string): void {
  const fullPath = join(LOCAL_STORAGE_PATH, path)
  if (!existsSync(dirname(fullPath))) {
    mkdirSync(dirname(fullPath), { recursive: true })
  }
}

/**
 * Generate thumbnail for local storage
 */
async function generateLocalThumbnail(
  sourceBuffer: Buffer,
  filename: string,
  options: ThumbnailOptions
): Promise<ThumbnailResult> {
  // Create Sharp instance
  let image = sharp(sourceBuffer)
  
  // Get original dimensions
  const metadata = await image.metadata()
  const origWidth = metadata.width || 0
  const origHeight = metadata.height || 0
  
  // Calculate target dimensions
  let targetWidth = options.width || 0
  let targetHeight = options.height || 0
  
  if (targetWidth && !targetHeight) {
    // Scale height proportionally
    targetHeight = Math.round(origHeight * (targetWidth / origWidth))
  } else if (targetHeight && !targetWidth) {
    // Scale width proportionally
    targetWidth = Math.round(origWidth * (targetHeight / origHeight))
  }
  
  // Generate thumbnail
  switch (options.mode) {
    case 'crop':
      image = image.resize(targetWidth, targetHeight, { fit: 'cover' })
      break
    case 'fit':
      image = image.resize(targetWidth, targetHeight, { fit: 'inside' })
      break
    default:
      image = image.resize(targetWidth, targetHeight)
  }
  
  // Set format and quality
  if (options.format) {
    image = image.toFormat(options.format, {
      quality: options.quality || 80,
    })
  }
  
  // Generate thumbnail name and path
  const thumbName = generateThumbName(filename, options)
  const storageKey = getHashedThumbPath(filename, thumbName)
  const thumbPath = join(LOCAL_STORAGE_PATH, storageKey)
  
  // Ensure directory exists
  ensureThumbDir(storageKey)
  
  // Save thumbnail
  await image.toFile(thumbPath)
  
  return {
    url: `/uploads/${storageKey}`,
    width: targetWidth,
    height: targetHeight,
    storageKey,
  }
}

/**
 * Generate thumbnail for S3 storage
 */
async function generateS3Thumbnail(
  sourceBuffer: Buffer,
  filename: string,
  options: ThumbnailOptions,
  s3Client: S3Client
): Promise<ThumbnailResult> {
  // Create Sharp instance
  let image = sharp(sourceBuffer)
  
  // Get original dimensions
  const metadata = await image.metadata()
  const origWidth = metadata.width || 0
  const origHeight = metadata.height || 0
  
  // Calculate target dimensions
  let targetWidth = options.width || 0
  let targetHeight = options.height || 0
  
  if (targetWidth && !targetHeight) {
    // Scale height proportionally
    targetHeight = Math.round(origHeight * (targetWidth / origWidth))
  } else if (targetHeight && !targetWidth) {
    // Scale width proportionally
    targetWidth = Math.round(origWidth * (targetHeight / origHeight))
  }
  
  // Generate thumbnail
  switch (options.mode) {
    case 'crop':
      image = image.resize(targetWidth, targetHeight, { fit: 'cover' })
      break
    case 'fit':
      image = image.resize(targetWidth, targetHeight, { fit: 'inside' })
      break
    default:
      image = image.resize(targetWidth, targetHeight)
  }
  
  // Set format and quality
  if (options.format) {
    image = image.toFormat(options.format, {
      quality: options.quality || 80,
    })
  }
  
  // Generate thumbnail buffer
  const thumbBuffer = await image.toBuffer()
  
  // Generate thumbnail name and path
  const thumbName = generateThumbName(filename, options)
  const storageKey = getHashedThumbPath(filename, thumbName)
  
  // Upload to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: storageKey,
      Body: thumbBuffer,
      ContentType: `image/${options.format || 'jpeg'}`,
    })
  )
  
  // Generate URL
  let url
  if (CDN_URL) {
    url = `${CDN_URL}/${storageKey}`
  } else {
    url = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: storageKey,
      }),
      { expiresIn: 3600 * 24 * 365 } // 1 year
    )
  }
  
  return {
    url,
    width: targetWidth,
    height: targetHeight,
    storageKey,
  }
}

/**
 * Generate thumbnail for a file
 */
export async function generateThumbnail(
  sourceBuffer: Buffer,
  filename: string,
  options: ThumbnailOptions,
  s3Client?: S3Client
): Promise<ThumbnailResult> {
  if (USE_LOCAL_STORAGE) {
    return generateLocalThumbnail(sourceBuffer, filename, options)
  }
  
  if (!s3Client) {
    throw new Error('S3 client required for S3 storage')
  }
  
  return generateS3Thumbnail(sourceBuffer, filename, options, s3Client)
}

/**
 * Generate all standard thumbnail sizes for a file
 */
export async function generateStandardThumbnails(
  sourceBuffer: Buffer,
  filename: string,
  s3Client?: S3Client
): Promise<ThumbnailResult[]> {
  const thumbnails = []
  
  for (const [size, width] of Object.entries(THUMB_SIZES)) {
    const thumbnail = await generateThumbnail(
      sourceBuffer,
      filename,
      {
        width,
        mode: 'fit',
        format: 'jpeg',
        quality: 80,
      },
      s3Client
    )
    thumbnails.push(thumbnail)
  }
  
  return thumbnails
}

/**
 * Delete all thumbnails for a file
 */
export async function deleteThumbnails(
  filename: string,
  s3Client?: S3Client
): Promise<void> {
  const thumbPath = getHashedThumbPath(filename, '')
  
  if (USE_LOCAL_STORAGE) {
    const fullPath = join(LOCAL_STORAGE_PATH, thumbPath)
    if (existsSync(fullPath)) {
      // Delete directory and all contents
      rm(fullPath, { recursive: true, force: true })
    }
  } else {
    if (!s3Client) {
      throw new Error('S3 client required for S3 storage')
    }
    
    // List and delete all objects with the thumb path prefix
    const objects = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: thumbPath,
      })
    )
    
    if (objects.Contents) {
      await Promise.all(
        objects.Contents.map(obj =>
          s3Client.send(
            new DeleteObjectCommand({
              Bucket: S3_BUCKET,
              Key: obj.Key,
            })
          )
        )
      )
    }
  }
}
