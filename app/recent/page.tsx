import Link from 'next/link'
import { getRecentPages } from '@/lib/wiki'

export const metadata = {
  title: 'Recent Changes - Wiki',
  description: 'View recently updated pages in the wiki',
}

interface RecentPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function RecentPage({ searchParams }: RecentPageProps) {
  const { page: pageParam } = await searchParams
  const page = parseInt(pageParam || '1')
  const pagesData = await getRecentPages(page, 50)

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">Recent Changes</h1>
      
      <div className="mb-6 text-sm text-gray-600">
        Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, pagesData.total)} of {pagesData.total} recently updated pages
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pagesData.pages.map((page) => (
          <Link
            key={page.slug}
            href={`/wiki/${page.slug}`}
            className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
          >
            <h3 className="font-semibold mb-1">{page.displayTitle}</h3>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Namespace: {page.namespace}</div>
              <div>Updated {new Date(page.updatedAt).toLocaleDateString()}</div>
              <div>{page.viewCount} views</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {(page > 1 || pagesData.hasMore) && (
        <div className="mt-8 flex justify-center gap-4">
          {page > 1 && (
            <Link
              href={`/recent?page=${page - 1}`}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              ← Previous
            </Link>
          )}
          <span className="px-4 py-2">Page {page}</span>
          {pagesData.hasMore && (
            <Link
              href={`/recent?page=${page + 1}`}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Next →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
