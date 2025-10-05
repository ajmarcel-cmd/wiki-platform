import Link from 'next/link'
import SearchBar from './SearchBar'

export default function Header() {
  return (
    <header className="border-b bg-white sticky top-0 z-40">
      <div className="max-w-[1024px] mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold text-gray-900">
              Wiki
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/wiki/Main_Page" className="text-xs hover:text-blue-600 transition-colors">
                Main Page
              </Link>
              <Link href="/all-pages" className="text-xs hover:text-blue-600 transition-colors">
                All Pages
              </Link>
              <Link href="/categories" className="text-xs hover:text-blue-600 transition-colors">
                Categories
              </Link>
              <Link href="/recent" className="text-xs hover:text-blue-600 transition-colors">
                Recent Changes
              </Link>
            </nav>
          </div>
          <SearchBar />
        </div>
      </div>
    </header>
  )
}
