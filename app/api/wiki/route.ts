import { NextRequest, NextResponse } from 'next/server'

import {
  DEFAULT_NAMESPACE_NAME,
  createPage,
  getCategoryTree,
  getPageBySlug,
  getPageRevisions,
  getRecentChanges,
  getSiteStats,
  getNamespaces,
  listAllCategoriesForApi,
  listAllPagesForApi,
  normalizeTitle,
  updatePage,
} from '@/lib/wiki'
import { parseWikiContent, getPageContext } from '@/lib/parser'

interface QueryResult {
  batchcomplete: boolean
  query: Record<string, unknown>
  continue?: Record<string, string>
}

type EditPayload = {
  action?: string
  title?: string
  page?: string
  text?: string
  summary?: string
  comment?: string
  minor?: string | boolean
  createonly?: string | boolean
  nocreate?: string | boolean
  actorId?: string
  actor_id?: string
}

function parseModules(value: string | null): string[] {
  if (!value) {
    return []
  }

  return value
    .split('|')
    .map((moduleName) => moduleName.trim().toLowerCase())
    .filter(Boolean)
}

function formatTitle(namespace: string, title: string) {
  return namespace === DEFAULT_NAMESPACE_NAME ? title : `${namespace}:${title}`
}

function badRequest(message: string): never {
  const error = new Error(message) as Error & { status?: number }
  error.status = 400
  throw error
}

function getErrorStatus(error: unknown, fallback: number): number {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status
    if (typeof status === 'number') {
      return status
    }
  }

  return fallback
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const action = (params.get('action') || 'query').toLowerCase()

    switch (action) {
      case 'query': {
        const result = await handleQuery(params)
        return NextResponse.json(result)
      }
      case 'parse': {
        const result = await handleParse(params)
        return NextResponse.json(result)
      }
      default:
        return NextResponse.json(
          { error: `Unsupported action: ${action}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error handling MediaWiki-style API GET:', error)
    const status = getErrorStatus(error, 500)
    const message = getErrorMessage(error, 'Internal server error')
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const contentType = request.headers.get('content-type') || ''

    let payload: EditPayload = {}

    if (contentType.includes('application/json')) {
      payload = (await request.json()) as EditPayload
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await request.formData()
      const formPayload: Partial<EditPayload> = {}
      for (const [key, value] of form.entries()) {
        const normalizedKey = key as keyof EditPayload
        formPayload[normalizedKey] = typeof value === 'string' ? value : value.toString()
      }
      payload = formPayload as EditPayload
    } else {
      try {
        payload = (await request.json()) as EditPayload
      } catch (error) {
        console.warn('MediaWiki-style API received POST without parseable body', error)
      }
    }

    const action = (payload.action || searchParams.get('action') || '').toLowerCase()

    switch (action) {
      case 'edit': {
        try {
          const result = await handleEdit(payload)
          return NextResponse.json(result)
        } catch (error) {
          console.error('Error editing via MediaWiki-style API:', error)
          const status = getErrorStatus(error, 500)
          const message = getErrorMessage(error, 'Failed to edit page')
          return NextResponse.json({ error: message }, { status })
        }
      }
      default:
        return NextResponse.json(
          { error: `Unsupported action: ${action || 'unknown'}` },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error handling MediaWiki-style API POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleQuery(params: URLSearchParams): Promise<QueryResult> {
  const metaModules = parseModules(params.get('meta'))
  const listModules = parseModules(params.get('list'))
  const propModules = parseModules(params.get('prop'))

  const query: Record<string, unknown> = {}
  let continuation: Record<string, string> | undefined

  const mergeContinuation = (value?: Record<string, string>) => {
    if (!value) return

    continuation = {
      ...(continuation ?? {}),
      ...value,
    }
  }

  if (metaModules.length > 0) {
    await handleMeta(metaModules, query)
  }

  if (listModules.length > 0) {
    const continueValue = await handleList(listModules, params, query)
    mergeContinuation(continueValue)
  }

  if (propModules.length > 0) {
    await handleProp(propModules, params, query)
  }

  const response: QueryResult = {
    batchcomplete: true,
    query,
  }

  if (continuation && Object.keys(continuation).length > 0) {
    response.continue = {
      continue: '-||',
      ...continuation,
    }
  }

  return response
}

async function handleMeta(modules: string[], query: Record<string, unknown>) {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Wiki'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
  const lang = process.env.NEXT_PUBLIC_CONTENT_LANG || 'en'

  for (const moduleName of modules) {
    switch (moduleName) {
      case 'siteinfo':
      case 'statistics': {
        const [stats, namespaces] = await Promise.all([
          getSiteStats(),
          getNamespaces(),
        ])

        query.general = {
          sitename: siteName,
          generator: 'Next.js Wiki Platform',
          lang,
          base: siteUrl,
        }

        query.statistics = stats
        query.namespaces = namespaces.reduce<Record<string, unknown>>((acc, namespace) => {
          acc[String(namespace.id)] = {
            id: namespace.id,
            name: namespace.name,
            canonical: namespace.canonical,
            '*': namespace.displayName,
          }
          return acc
        }, {})
        break
      }
      case 'categorytree': {
        query.categorytree = await getCategoryTree()
        break
      }
      default:
        // Ignore unsupported meta modules
        break
    }
  }
}

async function handleList(
  modules: string[],
  params: URLSearchParams,
  query: Record<string, unknown>
): Promise<Record<string, string> | undefined> {
  let continuation: Record<string, string> | undefined

  for (const moduleName of modules) {
    switch (moduleName) {
      case 'allpages': {
        const limit = parseInt(params.get('aplimit') || '50', 10)
        const continueFrom = params.get('apcontinue') || undefined
        const prefix = params.get('apprefix') || undefined

        const { items, continue: nextContinue } = await listAllPagesForApi({
          limit,
          continueFrom,
          prefix,
        })

        query.allpages = items.map((page) => ({
          pageid: page.id,
          title: formatTitle(page.namespace, page.title),
          ns: page.namespaceId,
          slug: page.slug,
          touched: page.updatedAt.toISOString(),
          views: page.viewCount,
        }))

        if (nextContinue) {
          continuation = {
            ...(continuation ?? {}),
            apcontinue: nextContinue,
          }
        }

        break
      }
      case 'allcategories': {
        const limit = parseInt(params.get('aclimit') || '100', 10)
        const continueFrom = params.get('accontinue') || undefined
        const prefix = params.get('acprefix') || undefined

        const { items, continue: nextContinue } = await listAllCategoriesForApi({
          limit,
          continueFrom,
          prefix,
        })

        query.allcategories = items.map((category) => ({
          category: `Category:${category.displayName}`,
          slug: category.slug,
          pages: category.pageCount,
          files: category.mediaCount,
          size: category.pageCount,
          hidden: false,
        }))

        if (nextContinue) {
          continuation = {
            ...(continuation ?? {}),
            accontinue: nextContinue,
          }
        }

        break
      }
      case 'recentchanges': {
        const limit = parseInt(params.get('rclimit') || '50', 10)
        const continueFrom = params.get('rccontinue') || undefined

        const { items, continue: nextContinue } = await getRecentChanges({
          limit,
          continueFrom,
        })

        query.recentchanges = items.map((change) => ({
          rcid: change.id,
          type: change.type,
          title: change.pageTitle
            ? formatTitle(change.namespace, change.pageTitle)
            : undefined,
          pageid: change.pageId,
          revid: change.revisionId,
          old_revid: change.oldRevisionId,
          oldlen: change.oldLength ?? undefined,
          newlen: change.newLength ?? undefined,
          timestamp: change.timestamp.toISOString(),
          ns: change.namespaceId,
          slug: change.pageSlug,
        }))

        if (nextContinue) {
          continuation = {
            ...(continuation ?? {}),
            rccontinue: nextContinue,
          }
        }

        break
      }
      default:
        // Unsupported list module, ignore gracefully
        break
    }
  }

  return continuation
}

async function handleProp(
  modules: string[],
  params: URLSearchParams,
  query: Record<string, unknown>
) {
  const titlesParam = params.get('titles')

  if (!titlesParam) {
    badRequest('titles parameter is required for prop modules')
  }

  const titleFragments = titlesParam
    .split('|')
    .map((title) => title.trim())
    .filter(Boolean)

  const normalizedTitles = await Promise.all(
    titleFragments.map((title) => normalizeTitle(title))
  )

  const pages: Record<string, unknown> = {}

  await Promise.all(
    normalizedTitles.map(async (normalized, index) => {
      const fullTitle = formatTitle(normalized.namespace, normalized.title)
      const page = await getPageBySlug(normalized.slug)

      if (!page) {
        const key = `-${index + 1}`
        pages[key] = {
          title: fullTitle,
          ns: normalized.namespaceId,
          missing: true,
        }
        return
      }

      const pageEntry: Record<string, unknown> = {
        pageid: page.id,
        ns: page.namespaceId,
        title: formatTitle(page.namespace, page.title),
        slug: page.slug,
      }

      if (modules.includes('info')) {
        pageEntry.touched = page.touched?.toISOString()
        pageEntry.length = page.length
        pageEntry.redirect = page.isRedirect || undefined
        pageEntry.new = page.isNew || undefined
        pageEntry.lastrevid = page.latestRevisionId || undefined
        pageEntry.pageviews = page.viewCount
      }

      if (modules.includes('categories')) {
        pageEntry.categories = page.categories.map((category) => ({
          title: `Category:${category.name}`,
          slug: category.slug,
        }))
      }

      if (modules.includes('revisions')) {
        const limit = parseInt(params.get('rvlimit') || '1', 10)
        const revisions = await getPageRevisions(page.slug, limit)

        pageEntry.revisions = revisions.map((revision) => ({
          revid: revision.id,
          parentid: revision.parentRevisionId,
          minor: revision.isMinor || undefined,
          user: revision.actor?.name,
          timestamp: revision.timestamp.toISOString(),
          size: revision.byteSize,
          sha1: revision.sha1,
          comment: revision.comment?.text || revision.summary || undefined,
        }))
      }

      pages[page.id] = pageEntry
    })
  )

  query.pages = pages
}

async function handleParse(params: URLSearchParams): Promise<Record<string, unknown>> {
  const titleParam = params.get('page') || params.get('title')
  const textParam = params.get('text')

  if (!titleParam && !textParam) {
    badRequest('Either title or text must be provided to parse')
  }

  const propModules = parseModules(params.get('prop'))
  const wantsHtml = propModules.length === 0 || propModules.includes('text')
  const wantsWikitext = propModules.includes('wikitext')
  const wantsCategories = propModules.includes('categories')
  const wantsSections = propModules.includes('sections')

  const response: Record<string, unknown> = {}

  if (textParam) {
    const contextTitle = titleParam || 'Preview'
    const normalized = await normalizeTitle(contextTitle)
    const parsed = await parseWikiContent(textParam, {
      page: {
        title: normalized.title,
        namespace: normalized.namespace,
      },
    })

    response.title = formatTitle(normalized.namespace, normalized.title)

    if (wantsHtml) {
      response.text = { '*': parsed.html }
    }

    if (wantsWikitext) {
      response.wikitext = { '*': textParam }
    }

    if (wantsCategories) {
      response.categories = parsed.categories.map((category) => ({
        sortkey: category,
        '*': category,
      }))
    }

    if (wantsSections) {
      response.sections = parsed.tableOfContents.map((entry, index) => ({
        index: String(index + 1),
        line: entry.text,
        anchor: entry.id,
        level: entry.level,
      }))
    }

    return response
  }

  if (!titleParam) {
    badRequest('Title is required when parsing stored pages')
  }

  const normalized = await normalizeTitle(titleParam)
  const page = await getPageBySlug(normalized.slug)

  if (!page) {
    return {
      error: 'missingtitle',
      info: `The page "${titleParam}" does not exist`,
    }
  }

  const context = await getPageContext(page.slug)
  const parsed = await parseWikiContent(page.content, context)

  response.pageid = page.id
  response.title = formatTitle(page.namespace, page.title)

  if (wantsHtml) {
    response.text = { '*': parsed.html }
  }

  if (wantsWikitext) {
    response.wikitext = { '*': page.content }
  }

  if (wantsCategories) {
    response.categories = page.categories.map((category) => ({
      sortkey: category.name,
      '*': category.name,
      slug: category.slug,
    }))
  }

  if (wantsSections) {
    response.sections = parsed.tableOfContents.map((entry, index) => ({
      index: String(index + 1),
      line: entry.text,
      anchor: entry.id,
      level: entry.level,
    }))
  }

  return response
}

async function handleEdit(payload: EditPayload): Promise<Record<string, unknown>> {
  const titleParam = payload.title || payload.page
  const text = payload.text

  if (!titleParam) {
    badRequest('title is required for edit action')
  }

  if (typeof text !== 'string') {
    badRequest('text is required for edit action')
  }

  const normalized = await normalizeTitle(titleParam)
  const fullTitle = formatTitle(normalized.namespace, normalized.title)
  const summary = payload.summary || payload.comment
  const isMinor = payload.minor === true || payload.minor === 'true'
  const createOnly = payload.createonly === true || payload.createonly === 'true'
  const noCreate = payload.nocreate === true || payload.nocreate === 'true'
  const actorId = payload.actorId || payload.actor_id

  const existingPage = await getPageBySlug(normalized.slug)

  if (existingPage && createOnly) {
    return {
      edit: {
        result: 'Failure',
        title: fullTitle,
        info: 'createonly mode was requested but the page already exists',
      },
    }
  }

  if (!existingPage && noCreate) {
    return {
      edit: {
        result: 'Failure',
        title: fullTitle,
        info: 'nocreate mode was requested but the page does not exist',
      },
    }
  }

  const previousRevisionId = existingPage?.latestRevisionId || null

  let page
  if (existingPage) {
    page = await updatePage({
      slug: existingPage.slug,
      content: text,
      summary,
      actorId,
      isMinor,
    })
  } else {
    page = await createPage({
      title: normalized.title,
      content: text,
      namespace: normalized.namespace,
      summary,
      actorId,
    })
  }

  const [latestRevision] = await getPageRevisions(page.slug, 1)

  return {
    edit: {
      result: 'Success',
      title: formatTitle(page.namespace, page.title),
      pageid: page.id,
      newrevid: latestRevision?.id,
      oldrevid: previousRevisionId,
      newtimestamp: latestRevision?.timestamp?.toISOString(),
    },
  }
}
