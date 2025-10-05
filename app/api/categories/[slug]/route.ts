import { NextRequest, NextResponse } from 'next/server'
import { getCategoryBySlug, getPagesByCategory } from '@/lib/wiki'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const [category, pagesData] = await Promise.all([
      getCategoryBySlug(slug),
      getPagesByCategory(slug, page, limit),
    ])

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      category,
      pages: pagesData.pages,
      pagination: {
        page,
        limit,
        total: pagesData.total,
        hasMore: pagesData.hasMore,
      },
    })
  } catch (error) {
    console.error('Error fetching category:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
