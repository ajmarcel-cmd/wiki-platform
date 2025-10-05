import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { addMediaToCategory, removeMediaFromCategory, getMediaCategories } from '@/lib/wiki'

interface RouteParams {
  params: Promise<{
    mediaId: string
  }>
}

// GET /api/media/[mediaId]/categories - Get categories for a media file
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { mediaId } = await params
    
    const categories = await getMediaCategories(mediaId)
    
    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Error fetching media categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch media categories' },
      { status: 500 }
    )
  }
}

// POST /api/media/[mediaId]/categories - Add media to category
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { mediaId } = await params
    const { categoryId, sortKey } = await request.json()
    
    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }
    
    // Check if media exists
    const media = await prisma.media.findUnique({
      where: { id: mediaId }
    })
    
    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }
    
    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    })
    
    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }
    
    // Add media to category
    const mediaCategory = await addMediaToCategory(mediaId, categoryId, sortKey)
    
    return NextResponse.json({ 
      success: true, 
      mediaCategory 
    })
  } catch (error) {
    console.error('Error adding media to category:', error)
    return NextResponse.json(
      { error: 'Failed to add media to category' },
      { status: 500 }
    )
  }
}

// DELETE /api/media/[mediaId]/categories - Remove media from category
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { mediaId } = await params
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    
    if (!categoryId) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }
    
    await removeMediaFromCategory(mediaId, categoryId)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing media from category:', error)
    return NextResponse.json(
      { error: 'Failed to remove media from category' },
      { status: 500 }
    )
  }
}
