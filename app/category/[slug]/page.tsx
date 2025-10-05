import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getCategoryBySlug, getPagesByCategory, getMediaByCategory } from '@/lib/wiki'

interface CategoryPageProps {
  params: Promise<{
    slug: string
  }>
  searchParams: Promise<{
    page?: string
    type?: string
  }>
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { slug } = await params
  const category = await getCategoryBySlug(slug)
  
  if (!category) {
    return {
      title: 'Category Not Found',
    }
  }

  return {
    title: `Category: ${category.displayName} - Wiki`,
    description: category.description || `Browse pages in the ${category.displayName} category`,
  }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params
  const { page: pageParam, type } = await searchParams
  const page = parseInt(pageParam || '1')
  const contentType = type || 'pages' // 'pages' or 'media'
  
  const [category, pagesData, mediaData] = await Promise.all([
    getCategoryBySlug(slug),
    getPagesByCategory(slug, page, 50),
    getMediaByCategory(slug, page, 50),
  ])

  if (!category) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-4">Category: {category.displayName}</h1>
      
      {category.description && (
        <p className="text-gray-600 mb-6">{category.description}</p>
      )}

      <div className="mb-6 text-sm text-gray-600">
        {contentType === 'pages' 
          ? `${pagesData.total} ${pagesData.total === 1 ? 'page' : 'pages'} in this category`
          : `${mediaData.total} ${mediaData.total === 1 ? 'media file' : 'media files'} in this category`
        }
      </div>

      {/* Content Type Tabs */}
      <div className="mb-6">
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
          <Link
            href={`/category/${slug}?type=pages`}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              contentType === 'pages'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Pages ({category._count.pages})
          </Link>
          <Link
            href={`/category/${slug}?type=media`}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              contentType === 'media'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Media ({category._count.media})
          </Link>
        </div>
      </div>


      {/* Content in category */}
      {contentType === 'pages' ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pagesData.pages.map((page) => (
            <Link
              key={page.slug}
              href={`/wiki/${page.slug}`}
              className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
            >
              <h3 className="font-semibold mb-1">{page.displayTitle}</h3>
              <div className="text-xs text-gray-500">
                Updated {new Date(page.updatedAt).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mediaData.media.map((media) => (
            <Link
              key={media.id}
              href={`/file/${encodeURIComponent(media.filename)}`}
              className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
            >
              {media.mimeType.startsWith('image/') && (
                <div className="mb-3">
                  <img
                    src={media.url || ''}
                    alt={media.displayName}
                    className="w-full h-32 object-cover rounded"
                  />
                </div>
              )}
              <h3 className="font-semibold mb-1 text-sm">{media.displayName}</h3>
              <div className="text-xs text-gray-500">
                {media.mimeType} • {Math.round(media.byteSize / 1024)}KB
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {((contentType === 'pages' && (page > 1 || pagesData.hasMore)) || 
        (contentType === 'media' && (page > 1 || mediaData.hasMore))) && (
        <div className="mt-8 flex justify-center gap-4">
          {page > 1 && (
            <Link
              href={`/category/${slug}?type=${contentType}&page=${page - 1}`}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              ← Previous
            </Link>
          )}
          <span className="px-4 py-2">Page {page}</span>
          {((contentType === 'pages' && pagesData.hasMore) || 
            (contentType === 'media' && mediaData.hasMore)) && (
            <Link
              href={`/category/${slug}?type=${contentType}&page=${page + 1}`}
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
