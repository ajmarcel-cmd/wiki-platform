/**
 * MediaWiki-compatible metadata extraction
 */

import sharp from 'sharp'
import { ExifTool } from 'exiftool-vendored'
import { getFileSha1 } from './hash-path'

// Initialize ExifTool
const exiftool = new ExifTool()

interface ImageMetadata {
  width: number
  height: number
  bits?: number
  colorSpace?: string
  orientation?: number
  format?: string
  hasAlpha?: boolean
  isAnimated?: boolean
  frameCount?: number
  duration?: number
}

interface ExifMetadata {
  make?: string
  model?: string
  software?: string
  dateTime?: string
  artist?: string
  copyright?: string
  gpsLatitude?: number
  gpsLongitude?: number
  gpsAltitude?: number
  exposureTime?: string
  fNumber?: number
  isoSpeedRatings?: number
  focalLength?: number
  focalLengthIn35mmFilm?: number
  flash?: number
}

interface VideoMetadata {
  width: number
  height: number
  duration: number
  frameRate?: number
  bitRate?: number
  audioCodec?: string
  videoCodec?: string
  audioChannels?: number
  audioSampleRate?: number
}

interface AudioMetadata {
  duration: number
  bitRate?: number
  codec?: string
  channels?: number
  sampleRate?: number
}

interface DocumentMetadata {
  pageCount?: number
  title?: string
  author?: string
  subject?: string
  keywords?: string[]
  creator?: string
  producer?: string
  creationDate?: string
  modificationDate?: string
}

interface MediaMetadata {
  sha1: string
  size: number
  width?: number
  height?: number
  bits?: number
  duration?: number
  image?: ImageMetadata
  exif?: ExifMetadata
  video?: VideoMetadata
  audio?: AudioMetadata
  document?: DocumentMetadata
  raw?: any
}

/**
 * Extract metadata from an image file
 */
async function extractImageMetadata(buffer: Buffer): Promise<MediaMetadata> {
  // Get basic image info using Sharp
  const sharpMetadata = await sharp(buffer).metadata()
  
  // Get EXIF data using ExifTool
  const tempFile = await exiftool.write(buffer)
  const exifData = await exiftool.read(tempFile)
  await exiftool.deleteTemp(tempFile)
  
  const metadata: MediaMetadata = {
    sha1: getFileSha1(buffer),
    size: buffer.length,
    width: sharpMetadata.width,
    height: sharpMetadata.height,
    bits: sharpMetadata.depth,
    image: {
      width: sharpMetadata.width || 0,
      height: sharpMetadata.height || 0,
      bits: sharpMetadata.depth,
      colorSpace: sharpMetadata.space,
      orientation: sharpMetadata.orientation,
      format: sharpMetadata.format,
      hasAlpha: sharpMetadata.hasAlpha,
      isAnimated: sharpMetadata.pages && sharpMetadata.pages > 1,
      frameCount: sharpMetadata.pages,
    },
    exif: {
      make: exifData.Make,
      model: exifData.Model,
      software: exifData.Software,
      dateTime: exifData.DateTimeOriginal || exifData.CreateDate,
      artist: exifData.Artist,
      copyright: exifData.Copyright,
      gpsLatitude: exifData.GPSLatitude,
      gpsLongitude: exifData.GPSLongitude,
      gpsAltitude: exifData.GPSAltitude,
      exposureTime: exifData.ExposureTime,
      fNumber: exifData.FNumber,
      isoSpeedRatings: exifData.ISO,
      focalLength: exifData.FocalLength,
      focalLengthIn35mmFilm: exifData.FocalLengthIn35mmFormat,
      flash: exifData.Flash,
    },
    raw: exifData,
  }
  
  return metadata
}

/**
 * Extract metadata from a video file
 */
async function extractVideoMetadata(buffer: Buffer): Promise<MediaMetadata> {
  // Use ExifTool for video metadata
  const tempFile = await exiftool.write(buffer)
  const data = await exiftool.read(tempFile)
  await exiftool.deleteTemp(tempFile)
  
  const metadata: MediaMetadata = {
    sha1: getFileSha1(buffer),
    size: buffer.length,
    width: data.ImageWidth,
    height: data.ImageHeight,
    duration: data.Duration,
    video: {
      width: data.ImageWidth,
      height: data.ImageHeight,
      duration: data.Duration,
      frameRate: data.VideoFrameRate,
      bitRate: data.VideoBitRate,
      audioCodec: data.AudioCodec,
      videoCodec: data.VideoCodec,
      audioChannels: data.AudioChannels,
      audioSampleRate: data.AudioSampleRate,
    },
    raw: data,
  }
  
  return metadata
}

/**
 * Extract metadata from an audio file
 */
async function extractAudioMetadata(buffer: Buffer): Promise<MediaMetadata> {
  // Use ExifTool for audio metadata
  const tempFile = await exiftool.write(buffer)
  const data = await exiftool.read(tempFile)
  await exiftool.deleteTemp(tempFile)
  
  const metadata: MediaMetadata = {
    sha1: getFileSha1(buffer),
    size: buffer.length,
    duration: data.Duration,
    audio: {
      duration: data.Duration,
      bitRate: data.AudioBitRate,
      codec: data.AudioCodec,
      channels: data.AudioChannels,
      sampleRate: data.AudioSampleRate,
    },
    raw: data,
  }
  
  return metadata
}

/**
 * Extract metadata from a PDF document
 */
async function extractDocumentMetadata(buffer: Buffer): Promise<MediaMetadata> {
  // Use ExifTool for document metadata
  const tempFile = await exiftool.write(buffer)
  const data = await exiftool.read(tempFile)
  await exiftool.deleteTemp(tempFile)
  
  const metadata: MediaMetadata = {
    sha1: getFileSha1(buffer),
    size: buffer.length,
    document: {
      pageCount: data.PageCount,
      title: data.Title,
      author: data.Author,
      subject: data.Subject,
      keywords: data.Keywords?.split(',').map((k: string) => k.trim()),
      creator: data.Creator,
      producer: data.Producer,
      creationDate: data.CreateDate,
      modificationDate: data.ModifyDate,
    },
    raw: data,
  }
  
  return metadata
}

/**
 * Extract metadata from any supported file type
 */
export async function extractMetadata(
  buffer: Buffer,
  mimeType: string
): Promise<MediaMetadata> {
  const [type] = mimeType.split('/')
  
  switch (type) {
    case 'image':
      return extractImageMetadata(buffer)
    case 'video':
      return extractVideoMetadata(buffer)
    case 'audio':
      return extractAudioMetadata(buffer)
    case 'application':
      if (mimeType === 'application/pdf') {
        return extractDocumentMetadata(buffer)
      }
      throw new Error(`Unsupported MIME type: ${mimeType}`)
    default:
      throw new Error(`Unsupported MIME type: ${mimeType}`)
  }
}

/**
 * Clean up ExifTool on process exit
 */
process.on('exit', () => {
  exiftool.end()
})
