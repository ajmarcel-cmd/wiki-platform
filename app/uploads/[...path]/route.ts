import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params
    const filePath = join(process.cwd(), 'uploads', ...path)
    
    // Security check: ensure the file is within the uploads directory
    const uploadsDir = join(process.cwd(), 'uploads')
    const resolvedPath = join(uploadsDir, ...path)
    
    if (!resolvedPath.startsWith(uploadsDir)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
    
    if (!existsSync(filePath)) {
      return new NextResponse('File not found', { status: 404 })
    }
    
    const fileBuffer = readFileSync(filePath)
    const filename = path[path.length - 1]
    
    // Determine content type based on file extension
    let contentType = 'application/octet-stream'
    if (filename.endsWith('.svg')) {
      contentType = 'image/svg+xml'
    } else if (filename.endsWith('.png')) {
      contentType = 'image/png'
    } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      contentType = 'image/jpeg'
    } else if (filename.endsWith('.gif')) {
      contentType = 'image/gif'
    } else if (filename.endsWith('.webp')) {
      contentType = 'image/webp'
    } else if (filename.endsWith('.pdf')) {
      contentType = 'application/pdf'
    } else if (filename.endsWith('.mp4')) {
      contentType = 'video/mp4'
    } else if (filename.endsWith('.webm')) {
      contentType = 'video/webm'
    }
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
