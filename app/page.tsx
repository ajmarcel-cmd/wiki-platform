import Link from "next/link";
import { getAllCategories, getRecentPages, getSiteStats } from "@/lib/wiki";

export default async function Home() {
  const [stats, recent, categories] = await Promise.all([
    getSiteStats(),
    getRecentPages(1, 12),
    getAllCategories(),
  ]);

  const topCategories = [...categories]
    .sort((a, b) => b._count.pages - a._count.pages)
    .slice(0, 15);

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-4">Welcome to Wiki</h1>
        <p className="text-xl text-gray-600 mb-8">
          A scalable MediaWiki-compatible platform powered by Next.js
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/wiki/Main_Page"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            View Main Page
          </Link>
          <Link
            href="/all-pages"
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Browse All Pages
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-16">
        <StatCard
          label="Total Pages"
          value={stats.pages}
          accent="text-blue-600"
        />
        <StatCard
          label="Articles"
          value={stats.articles}
          accent="text-emerald-600"
        />
        <StatCard
          label="Categories"
          value={stats.categories}
          accent="text-purple-600"
        />
        <StatCard
          label="Media Files"
          value={stats.files}
          accent="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
        <StatCard
          label="Total Edits"
          value={stats.edits}
          accent="text-blue-500"
        />
        <StatCard
          label="Active Contributors"
          value={stats.activeUsers}
          accent="text-green-500"
        />
      </div>

      {/* Recent Pages */}
      <div className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Recent Pages</h2>
          <Link
            href="/all-pages"
            className="text-blue-600 hover:underline text-sm"
          >
            View all →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recent.pages.map((page) => (
            <Link
              key={page.slug}
              href={`/wiki/${page.slug}`}
              className="p-4 bg-white border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
            >
              <h3 className="font-semibold mb-1">{page.displayTitle}</h3>
              <div className="text-xs text-gray-500 space-y-1">
                <div>Updated {new Date(page.updatedAt).toLocaleDateString()}</div>
                <div>{page.viewCount} views</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Popular Categories */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Popular Categories</h2>
          <Link
            href="/categories"
            className="text-blue-600 hover:underline text-sm"
          >
            View all →
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          {topCategories.map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              className="px-4 py-2 bg-white border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
            >
              <div className="font-medium">{category.displayName}</div>
              <div className="text-xs text-gray-500">
                {category._count.pages} pages • {category._count.media} media
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <div className="mt-16 p-8 bg-blue-50 rounded-lg border border-blue-200">
        <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
        <div className="prose prose-blue">
          <p className="text-gray-700 mb-4">
            This wiki is built with scalability in mind, designed to handle
            terabytes of data and hundreds of thousands of concurrent readers.
          </p>
          <ul className="text-gray-700 space-y-2">
            <li>
              <strong>Database:</strong> PostgreSQL with logical sharding support
            </li>
            <li>
              <strong>Caching:</strong> Next.js caching with Redis-ready adapters
            </li>
            <li>
              <strong>Search:</strong> Full-text search with Meilisearch-ready index
            </li>
            <li>
              <strong>Deployment:</strong> Optimized for Vercel free tier or any
              Node.js hosting
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  accent: string;
}

function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div className="bg-white p-6 rounded-lg border text-center">
      <div className={`text-3xl font-bold mb-2 ${accent}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-gray-600">{label}</div>
    </div>
  );
}
