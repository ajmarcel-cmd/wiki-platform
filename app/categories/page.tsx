import Link from 'next/link'
import { getAllCategories, getCategoryTree, type CategoryTreeNode } from '@/lib/wiki'

export const metadata = {
  title: 'Categories - Wiki',
  description: 'Browse all categories in the wiki',
}

export default async function CategoriesPage() {
  const [categories, categoryTree] = await Promise.all([
    getAllCategories(),
    getCategoryTree(),
  ])

  // Group categories by first letter
  const groupedCategories = categories.reduce((acc, category) => {
    const firstLetter = category.displayName[0].toUpperCase()
    if (!acc[firstLetter]) {
      acc[firstLetter] = []
    }
    acc[firstLetter].push(category)
    return acc
  }, {} as Record<string, typeof categories>)

  const letters = Object.keys(groupedCategories).sort()

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-6">Categories</h1>
      
      <div className="mb-6 text-sm text-gray-600">
        {categories.length} {categories.length === 1 ? 'category' : 'categories'} total
      </div>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4 text-gray-700">Category Tree</h2>
        {categoryTree.length === 0 ? (
          <p className="text-gray-500">No categories have been created yet.</p>
        ) : (
          <div className="bg-white border rounded-lg p-6">
            <CategoryTree nodes={categoryTree} />
          </div>
        )}
      </section>

      <div className="space-y-8">
        {letters.map((letter) => (
          <div key={letter}>
            <h2 className="text-2xl font-bold mb-4 text-gray-700">{letter}</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {groupedCategories[letter].map((category) => (
                <Link
                  key={category.slug}
                  href={`/category/${category.slug}`}
                  className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <h3 className="font-semibold mb-1">{category.displayName}</h3>
                  <div className="text-sm text-gray-600">
                    {category._count.pages} {category._count.pages === 1 ? 'page' : 'pages'} • {category._count.media} {category._count.media === 1 ? 'media file' : 'media files'}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CategoryTree({ nodes, depth = 0 }: { nodes: CategoryTreeNode[]; depth?: number }) {
  if (!nodes || nodes.length === 0) {
    return null
  }

  return (
    <ul className={depth === 0 ? 'space-y-3' : 'space-y-3 border-l border-gray-200 pl-4 mt-3'}>
      {nodes.map((node) => (
        <li key={`${depth}-${node.slug}`}>
          <div className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full bg-blue-500" aria-hidden />
            <div>
              <Link
                href={`/category/${node.slug}`}
                className="font-medium text-blue-600 hover:text-blue-800"
              >
                {node.displayName}
              </Link>
              <div className="text-xs text-gray-500">
                {node.pageCount} {node.pageCount === 1 ? 'page' : 'pages'}
                {node.mediaCount > 0 && ` • ${node.mediaCount} ${node.mediaCount === 1 ? 'file' : 'files'}`}
              </div>
            </div>
          </div>
          {node.subcategories.length > 0 && (
            <CategoryTree nodes={node.subcategories} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  )
}
