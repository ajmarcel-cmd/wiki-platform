import { notFound, redirect } from 'next/navigation'
import { getPageBySlug } from '@/lib/wiki'
import { parseWikiContent, getPageContext } from '@/lib/parser'
import WikiContent from '@/app/components/WikiContent'

export const revalidate = 3600 // Revalidate every hour

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const page = await getPageBySlug(slug)
  
  if (!page) {
    return {
      title: 'Page Not Found',
    }
  }

  return {
    title: `${page.displayTitle} - Wiki`,
    description: `Wiki page: ${page.displayTitle}`,
  }
}

export default async function WikiPage({ params }: PageProps) {
  const { slug } = await params
  const page = await getPageBySlug(slug)

  if (!page) {
    notFound()
  }

  // Handle redirects
  if (page.isRedirect && page.redirectTarget) {
    // If redirect target starts with /, it's an absolute path
    if (page.redirectTarget.startsWith('/')) {
      redirect(page.redirectTarget)
    } else {
      // Otherwise, it's a wiki page slug
      redirect(`/wiki/${page.redirectTarget}`)
    }
  }

  // Get page context for parser
  const context = await getPageContext(slug)
  
  // Parse content
  const { html, categories: parsedCategories, tableOfContents } = await parseWikiContent(page.content, context)

  const categoryLinks = page.categories.length > 0
    ? page.categories.map((category) => ({ name: category.name, slug: category.slug }))
    : parsedCategories.map((name) => ({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      }))

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <WikiContent
          html={html}
          title={page.displayTitle}
          categories={categoryLinks}
          tableOfContents={tableOfContents}
        />
        
        {/* Page metadata */}
        <div className="mt-8 pt-4 border-t text-sm text-gray-600">
          <p>
            Last updated: {new Date(page.updatedAt).toLocaleDateString()} • 
            Views: {page.viewCount.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
