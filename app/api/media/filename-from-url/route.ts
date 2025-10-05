import { NextRequest, NextResponse } from 'next/server'
import { getOriginalFilenameFromUrl } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }
    
    const filename = await getOriginalFilenameFromUrl(url)
    
    if (!filename) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    return NextResponse.json({ filename })
  } catch (error) {
    console.error('Error getting filename from URL:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
