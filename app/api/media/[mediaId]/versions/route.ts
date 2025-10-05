import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getFileUrl } from '@/lib/storage'

interface RouteParams {
  params: {
    mediaId: string
  }
}

/**
 * GET /api/media/[mediaId]/versions
 * Get version history for a media file
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { mediaId } = params

    // Get current version
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
    })

    if (!media) {
      return NextResponse.json(
        { error: 'Media not found' },
        { status: 404 }
      )
    }

    // Get archived versions
    const archives = await prisma.mediaArchive.findMany({
      where: { mediaId },
      orderBy: { timestamp: 'desc' },
      include: {
        actor: true,
      },
    })

    // Format response
    const versions = [
      // Current version
      {
        timestamp: media.uploadedAt,
        url: media.url || await getFileUrl(media.storageKey),
        storageKey: media.storageKey,
        size: media.byteSize,
        width: media.width,
        height: media.height,
        sha1: media.sha1,
        uploader: media.uploadedById,
        description: media.description,
        isCurrent: true,
      },
      // Archived versions
      ...archives.map(archive => ({
        timestamp: archive.timestamp,
        url: archive.url || getFileUrl(archive.storageKey),
        storageKey: archive.storageKey,
        size: archive.size,
        width: archive.width,
        height: archive.height,
        sha1: archive.sha1,
        uploader: archive.actorId,
        description: archive.description,
        isCurrent: false,
      })),
    ]

    return NextResponse.json({
      success: true,
      versions,
    })
  } catch (error) {
    console.error('Error getting media versions:', error)
    return NextResponse.json(
      { error: 'Failed to get media versions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/media/[mediaId]/versions/[versionId]/restore
 * Restore an old version of a media file
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { mediaId } = params
    const { versionId, actorId } = await request.json()

    // Get media and version to restore
    const [media, version] = await Promise.all([
      prisma.media.findUnique({
        where: { id: mediaId },
      }),
      prisma.mediaArchive.findUnique({
        where: { id: versionId },
      }),
    ])

    if (!media || !version) {
      return NextResponse.json(
        { error: 'Media or version not found' },
        { status: 404 }
      )
    }

    // Archive current version
    await prisma.mediaArchive.create({
      data: {
        mediaId: media.id,
        archiveName: `${Date.now()}!${media.filename}`,
        storageKey: media.storageKey,
        size: media.byteSize,
        width: media.width,
        height: media.height,
        bits: media.bits,
        metadata: media.metadata,
        majorMime: media.majorMime,
        minorMime: media.minorMime,
        description: `Replaced by restored version from ${version.timestamp}`,
        actorId,
        sha1: media.sha1,
        mediaType: media.mediaType,
      },
    })

    // Restore old version as current
    await prisma.media.update({
      where: { id: mediaId },
      data: {
        storageKey: version.storageKey,
        byteSize: version.size,
        width: version.width,
        height: version.height,
        bits: version.bits,
        metadata: version.metadata,
        majorMime: version.majorMime,
        minorMime: version.minorMime,
        sha1: version.sha1,
        mediaType: version.mediaType,
        uploadedById: actorId,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Version restored successfully',
    })
  } catch (error) {
    console.error('Error restoring media version:', error)
    return NextResponse.json(
      { error: 'Failed to restore media version' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/media/[mediaId]/versions/[versionId]
 * Delete a specific version of a media file
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { mediaId } = params
    const { versionId } = await request.json()

    // Get version to delete
    const version = await prisma.mediaArchive.findFirst({
      where: {
        id: versionId,
        mediaId,
      },
    })

    if (!version) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      )
    }

    // Delete version from storage and database
    await prisma.mediaArchive.delete({
      where: { id: versionId },
    })

    return NextResponse.json({
      success: true,
      message: 'Version deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting media version:', error)
    return NextResponse.json(
      { error: 'Failed to delete media version' },
      { status: 500 }
    )
  }
}
