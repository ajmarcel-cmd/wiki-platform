import { NextRequest, NextResponse } from 'next/server'
import { listMedia } from '@/lib/storage'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    const media = await listMedia(limit, offset)

    return NextResponse.json({
      media,
      pagination: {
        limit,
        offset,
        count: media.length,
      },
    })
  } catch (error) {
    console.error('Error listing media:', error)
    return NextResponse.json(
      { error: 'Failed to list media' },
      { status: 500 }
    )
  }
}
