import { NextRequest, NextResponse } from 'next/server'
import { searchPages } from '@/lib/wiki'
import { searchWithMeilisearch, isMeilisearchAvailable } from '@/lib/search'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '20')
    const filter = searchParams.get('filter') || undefined

    if (!query.trim()) {
      return NextResponse.json({ results: [] })
    }

    // Try Meilisearch first, fallback to database search
    const useMeilisearch = await isMeilisearchAvailable()
    
    if (useMeilisearch) {
      const results = await searchWithMeilisearch(query, { 
        limit,
        filter 
      })
      return NextResponse.json({ results, source: 'meilisearch' })
    } else {
      const results = await searchPages(query, limit)
      return NextResponse.json({ results, source: 'database' })
    }
  } catch (error) {
    console.error('Error searching pages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
