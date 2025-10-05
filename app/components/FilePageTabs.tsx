'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface FilePageTabsProps {
  filename: string
}

export default function FilePageTabs({ filename }: FilePageTabsProps) {
  const pathname = usePathname()
  const baseUrl = `/wiki/File:${encodeURIComponent(filename)}`
  
  const tabs = [
    { name: 'File', href: baseUrl },
    { name: 'History', href: `${baseUrl}/history` },
    { name: 'Metadata', href: `${baseUrl}/metadata` },
  ]

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
