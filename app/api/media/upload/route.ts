import { NextRequest, NextResponse } from 'next/server'
import { uploadFile, isStorageAvailable } from '@/lib/storage'
import { publishMediaUploaded } from '@/lib/events'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Check if storage is available
    const storageAvailable = await isStorageAvailable()
    if (!storageAvailable) {
      return NextResponse.json(
        { error: 'Media storage is not configured' },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const description = formData.get('description') as string
    const actorId = formData.get('actorId') as string
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file size (max 100MB for now)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100MB' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload file with MediaWiki-compatible metadata
    const media = await uploadFile({
      filename: file.name,
      contentType: file.type,
      buffer,
      description,
      actorId,
      metadata: {
        uploadedAt: new Date().toISOString(),
        uploadedBy: actorId || 'system',
      },
    })

    // Publish event
    await publishMediaUploaded(media.id, media.filename)

    return NextResponse.json({
      success: true,
      media,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}