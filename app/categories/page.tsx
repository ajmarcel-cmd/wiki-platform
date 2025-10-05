import Link from 'next/link'
import { getAllCategories } from '@/lib/wiki'

export const metadata = {
  title: 'Categories - Wiki',
  description: 'Browse all categories in the wiki',
}

export default async function CategoriesPage() {
  const categories = await getAllCategories()

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
        {categories.length} {categories.length === 1 ? 'category' : 'categories'}
      </div>

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
