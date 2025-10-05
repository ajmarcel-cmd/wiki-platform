'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createRoot } from 'react-dom/client'

interface Category {
  name: string
  slug: string
}

interface WikiContentProps {
  html: string
  title: string
  categories?: Category[]
  tableOfContents?: Array<{ level: number; text: string; id: string }>
}

export default function WikiContent({ html, title, categories, tableOfContents }: WikiContentProps) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string; filename: string | null } | null>(null)
  const [isTocCollapsed, setIsTocCollapsed] = useState(false)

  // Function to create MediaWiki-style TOC
  const createToc = () => {
    if (!tableOfContents || tableOfContents.length === 0) return null;

    return (
      <div className={`toc ${isTocCollapsed ? 'collapsed' : ''}`}>
        <div 
          className="toc-header cursor-pointer" 
          onClick={() => setIsTocCollapsed(!isTocCollapsed)}
        >
          <h2 className="inline-block mr-2 text-lg font-normal">Contents</h2>
          <span className="toc-toggle text-blue-600 hover:text-blue-800">
            [{isTocCollapsed ? 'show' : 'hide'}]
          </span>
        </div>
        {!isTocCollapsed && (
          <div className="toc-content mt-2">
            <ul className="list-none pl-0">
              {tableOfContents.map((item, index) => (
                <li 
                  key={index} 
                  className="my-1"
                  style={{ marginLeft: `${(item.level - 1) * 1.5}em` }}
                >
                  <a 
                    href={`#${item.id}`}
                    className="text-blue-600 hover:text-blue-800 no-underline hover:underline"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // Function to create MediaWiki-style categories
  const createCategories = () => {
    if (!categories || categories.length === 0) return null;

    // Group categories by first letter
    const groupedCategories = categories.reduce((acc, cat) => {
      const firstChar = cat.name.charAt(0).toUpperCase();
      if (!acc[firstChar]) acc[firstChar] = [];
      acc[firstChar].push(cat);
      return acc;
    }, {} as Record<string, Category[]>);

    return (
      <div className="catlinks mt-8 pt-4 border-t">
        <div className="mw-normal-catlinks">
          <span className="text-gray-600">Categories: </span>
          {Object.entries(groupedCategories).map(([char, cats], groupIndex) => (
            <span key={char}>
              {groupIndex > 0 && ' | '}
              {cats.map((cat, i) => (
                <span key={cat.slug}>
                  {i > 0 && ' • '}
                  <Link
                    href={`/category/${cat.slug}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {cat.name}
                  </Link>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (contentRef.current) {
      // Insert content
      contentRef.current.innerHTML = html;
      
      // Insert TOC after first paragraph
      const toc = createToc();
      if (toc) {
        const firstParagraph = contentRef.current.querySelector('p');
        if (firstParagraph) {
          const tocContainer = document.createElement('div');
          tocContainer.className = 'mw-toc-container my-4 p-4 bg-gray-50 border rounded';
          const root = createRoot(tocContainer);
          root.render(toc);
          firstParagraph.after(tocContainer);
        }
      }
    }
  }, [html, isTocCollapsed, tableOfContents])

  useEffect(() => {
    // Add click handlers for images and ESC key handler
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null)
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    
    if (contentRef.current) {
      const images = contentRef.current.querySelectorAll('img')
      images.forEach((img) => {
        img.style.cursor = 'pointer'
        img.title = 'Click to view full size'
        
        const clickHandler = async (e: Event) => {
          e.preventDefault()
          e.stopPropagation()
          
          const src = (img as HTMLImageElement).src
          let filename: string | null = null
          
          // Try to get the original filename from the URL
          if (src) {
            try {
              console.log('🔍 WikiContent: Making API call for URL:', src)
              const response = await fetch('/api/media/filename-from-url', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: src }),
              })
              
              console.log('🔍 WikiContent: API response status:', response.status)
              
              if (response.ok) {
                const data = await response.json()
                console.log('🔍 WikiContent: API response data:', data)
                filename = data.filename
              } else {
                console.error('🔍 WikiContent: API call failed:', response.status, response.statusText)
              }
            } catch (error) {
              console.error('🔍 WikiContent: Error getting filename from URL:', error)
            }
          }
          
          setLightboxImage({
            src: (img as HTMLImageElement).src,
            alt: (img as HTMLImageElement).alt || 'Image',
            filename
          })
        }
        
        // Add new listener
        img.addEventListener('click', clickHandler as EventListener)
      })
    }
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [html])

  return (
    <>
      <article className="wiki-article">
        <div
          ref={contentRef}
          className="wiki-content prose max-w-none"
        />
        {createCategories()}
      </article>

      {/* Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-7xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 text-3xl font-bold z-10"
            >
              ✕
            </button>
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              className="max-w-full max-h-[80vh] object-contain rounded"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-4 bg-black bg-opacity-90 text-white p-4 rounded-lg max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm mb-2">{lightboxImage.alt}</p>
              {lightboxImage.filename ? (
                <div className="flex gap-4 items-center justify-center">
                  <Link
                    href={`/file/${encodeURIComponent(lightboxImage.filename)}`}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                    onClick={(e) => e.stopPropagation()}
                  >
                    📄 View File Information
                  </Link>
                  <a
                    href={lightboxImage.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    🔗 Open Full Size
                  </a>
                </div>
              ) : (
                <div className="text-center">
                  <a
                    href={lightboxImage.src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors inline-block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    🔗 Open Full Size
                  </a>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-3 text-center">
                Click outside to close • ESC to close
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
