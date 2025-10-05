/**
 * MediaWiki-compatible file path hashing
 * Based on LocalRepo.php from MediaWiki core
 */

import crypto from 'crypto'

/**
 * Get a hashed path structure for a given filename
 * @param filename The original filename
 * @returns Directory structure (e.g. "a/a2/")
 */
export function getHashPath(filename: string): string {
  // Normalize filename
  const name = filename.replace(/ /g, '_')
  
  // Generate MD5 hash
  const hash = crypto.createHash('md5').update(name).digest('hex')
  
  // MediaWiki uses first character and first two characters for directory levels
  const d1 = hash.substring(0, 1)
  const d2 = hash.substring(0, 2)
  
  return `${d1}/${d2}/`
}

/**
 * Get a hashed storage path for a given filename
 * @param filename The original filename
 * @returns Full storage path including filename
 */
export function getHashedStoragePath(filename: string): string {
  const hashPath = getHashPath(filename)
  const normalizedName = filename.replace(/ /g, '_')
  return `${hashPath}${normalizedName}`
}

/**
 * Get a hashed storage path for an archived version of a file
 * @param filename The original filename
 * @param archiveName The archive name (timestamp!filename format)
 * @returns Full archive storage path
 */
export function getHashedArchivePath(filename: string, archiveName: string): string {
  const hashPath = getHashPath(filename)
  return `archive/${hashPath}${archiveName}`
}

/**
 * Get a hashed storage path for a thumbnail
 * @param filename The original filename
 * @param thumbName The thumbnail filename
 * @returns Full thumbnail storage path
 */
export function getHashedThumbPath(filename: string, thumbName: string): string {
  const hashPath = getHashPath(filename)
  return `thumb/${hashPath}${filename}/${thumbName}`
}

/**
 * Get a SHA-1 hash for a file
 * @param buffer File contents
 * @returns SHA-1 hash in base-36 format (like MediaWiki)
 */
export function getFileSha1(buffer: Buffer): string {
  const sha1 = crypto.createHash('sha1').update(buffer).digest('hex')
  return BigInt(`0x${sha1}`).toString(36)
}

/**
 * Split a MIME type into major and minor parts
 * @param mimeType Full MIME type (e.g. "image/jpeg")
 * @returns [major, minor] tuple
 */
export function splitMimeType(mimeType: string): [string, string] {
  const [major = 'unknown', minor = 'unknown'] = mimeType.split('/')
  return [major, minor]
}

/**
 * Get the media type for a given MIME type
 * @param mimeType Full MIME type
 * @returns MediaWiki media type constant
 */
export function getMediaType(mimeType: string): string {
  const [major] = splitMimeType(mimeType)
  
  switch (major) {
    case 'image':
      return 'BITMAP'
    case 'audio':
      return 'AUDIO'
    case 'video':
      return 'VIDEO'
    case 'application':
      if (mimeType === 'application/pdf') {
        return 'OFFICE'
      }
      return 'MULTIMEDIA'
    case 'text':
      return 'TEXT'
    default:
      return 'UNKNOWN'
  }
}
