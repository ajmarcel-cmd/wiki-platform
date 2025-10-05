import { NextRequest, NextResponse } from 'next/server'
import { getPageBySlug, incrementPageViews, createPage, updatePage } from '@/lib/wiki'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // Opt out of caching for view count

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const page = await getPageBySlug(slug)

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      )
    }

    // Increment view count asynchronously (don't wait)
    incrementPageViews(slug).catch(console.error)

    return NextResponse.json(page)
  } catch (error) {
    console.error('Error fetching wiki page:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const body = await request.json()
    const { title, content, summary, actorId, isMinor } = body

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Check if page exists
    const existingPage = await getPageBySlug(slug)
    
    let page
    if (existingPage) {
      // Update existing page
      page = await updatePage({
        slug,
        content,
        summary,
        actorId,
        isMinor
      })
    } else {
      // Create new page
      page = await createPage({
        title: title || slug,
        content,
        summary,
        actorId
      })
    }

    return NextResponse.json({
      success: true,
      page
    })
  } catch (error) {
    console.error('Error creating/updating wiki page:', error)
    return NextResponse.json(
      { error: 'Failed to create/update page' },
      { status: 500 }
    )
  }
}
