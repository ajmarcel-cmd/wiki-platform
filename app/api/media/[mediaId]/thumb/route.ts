import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateThumbnail, THUMB_SIZES, generateStandardThumbnails, deleteThumbnails } from '@/lib/storage/thumbnails'
import { getS3Client } from '@/lib/storage'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'
import { join } from 'path'

interface RouteParams {
  params: {
    mediaId: string
  }
}

/**
 * GET /api/media/[mediaId]/thumb
 * Get or generate a thumbnail for a media file
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { mediaId } = params
    const { searchParams } = new URL(request.url)
    
    // Get thumbnail parameters
    const width = parseInt(searchParams.get('width') || '0')
    const height = parseInt(searchParams.get('height') || '0')
    const mode = searchParams.get('mode') as 'resize' | 'crop' | 'fit' || 'fit'
    const format = searchParams.get('format') as 'jpeg' | 'png' | 'webp' || 'jpeg'
    const quality = parseInt(searchParams.get('quality') || '80')
    
    // Validate parameters
    if (!width && !height) {
      return NextResponse.json(
        { error: 'Width or height required' },
        { status: 400 }
      )
    }
    
    // Get media file
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    })
    
    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }
    
    // Only generate thumbnails for images
    if (!media.majorMime.startsWith('image')) {
      return NextResponse.json(
        { error: 'Not an image' },
        { status: 400 }
      )
    }
    
    // Get source file
    let sourceBuffer: Buffer
    if (process.env.USE_LOCAL_STORAGE === 'true') {
      const filePath = join(process.env.LOCAL_STORAGE_PATH || '', media.storageKey)
      sourceBuffer = readFileSync(filePath)
    } else {
      const s3Client = getS3Client()
      if (!s3Client) {
        throw new Error('S3 storage not configured')
      }
      
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET || '',
          Key: media.storageKey,
        })
      )
      
      sourceBuffer = Buffer.from(await response.Body?.transformToByteArray() || [])
    }
    
    // Generate thumbnail
    const thumbnail = await generateThumbnail(
      sourceBuffer,
      media.filename,
      {
        width,
        height,
        mode,
        format,
        quality,
      },
      process.env.USE_LOCAL_STORAGE === 'true' ? undefined : getS3Client()
    )
    
    return NextResponse.json({
      success: true,
      thumbnail,
    })
  } catch (error) {
    console.error('Error generating thumbnail:', error)
    return NextResponse.json(
      { error: 'Failed to generate thumbnail' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/media/[mediaId]/thumb/generate
 * Generate all standard thumbnail sizes for a media file
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { mediaId } = params
    
    // Get media file
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    })
    
    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }
    
    // Only generate thumbnails for images
    if (!media.majorMime.startsWith('image')) {
      return NextResponse.json(
        { error: 'Not an image' },
        { status: 400 }
      )
    }
    
    // Get source file
    let sourceBuffer: Buffer
    if (process.env.USE_LOCAL_STORAGE === 'true') {
      const filePath = join(process.env.LOCAL_STORAGE_PATH || '', media.storageKey)
      sourceBuffer = readFileSync(filePath)
    } else {
      const s3Client = getS3Client()
      if (!s3Client) {
        throw new Error('S3 storage not configured')
      }
      
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET || '',
          Key: media.storageKey,
        })
      )
      
      sourceBuffer = Buffer.from(await response.Body?.transformToByteArray() || [])
    }
    
    // Generate all standard thumbnails
    const thumbnails = await generateStandardThumbnails(
      sourceBuffer,
      media.filename,
      process.env.USE_LOCAL_STORAGE === 'true' ? undefined : getS3Client()
    )
    
    // Update media record with thumbnail info
    await prisma.media.update({
      where: { id: mediaId },
      data: {
        metadata: {
          ...media.metadata,
          thumbnails,
        },
      },
    })
    
    return NextResponse.json({
      success: true,
      thumbnails,
    })
  } catch (error) {
    console.error('Error generating thumbnails:', error)
    return NextResponse.json(
      { error: 'Failed to generate thumbnails' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/media/[mediaId]/thumb
 * Delete all thumbnails for a media file
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { mediaId } = params
    
    // Get media file
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    })
    
    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }
    
    // Delete all thumbnails
    await deleteThumbnails(
      media.filename,
      process.env.USE_LOCAL_STORAGE === 'true' ? undefined : getS3Client()
    )
    
    // Update media record
    await prisma.media.update({
      where: { id: mediaId },
      data: {
        metadata: {
          ...media.metadata,
          thumbnails: [],
        },
      },
    })
    
    return NextResponse.json({
      success: true,
      message: 'Thumbnails deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting thumbnails:', error)
    return NextResponse.json(
      { error: 'Failed to delete thumbnails' },
      { status: 500 }
    )
  }
}
