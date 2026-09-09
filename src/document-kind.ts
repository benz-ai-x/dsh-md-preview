/** Name-only preview candidates shared by Host search and Client entry points.
 * A candidate is never a read grant: the Host and fs validate every open. */

// Office is excluded. Media, PDF and HTML await their own preview readers;
// common binary containers keep the native external-open behavior.
const NON_TEXT_FORMATS = new Set([
  '.doc', '.docx', '.docm', '.dot', '.dotx', '.dotm', '.rtf',
  '.xls', '.xlsx', '.xlsm', '.xlsb', '.xlt', '.xltx', '.xltm',
  '.ppt', '.pptx', '.pptm', '.pot', '.potx', '.potm', '.pps', '.ppsx', '.ppsm',
  '.odt', '.ods', '.odp', '.odg', '.ott', '.ots', '.otp',
  '.pages', '.numbers', '.key',
  '.html', '.htm', '.xhtml', '.pdf',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.bmp', '.ico', '.svg', '.tif', '.tiff', '.heic',
  '.mp3', '.wav', '.ogg', '.oga', '.flac', '.aac', '.m4a', '.opus',
  '.mp4', '.webm', '.mov', '.avi', '.mkv', '.mpeg', '.mpg', '.m4v', '.ogv',
  '.zip', '.gz', '.tar', '.bz2', '.xz', '.zst', '.7z', '.rar',
  '.bin', '.exe', '.dll', '.so', '.dylib', '.wasm', '.woff', '.woff2', '.ttf', '.otf',
])

/** Include unknown extensions and extensionless names without probing contents. */
export function isTextPreviewCandidate(path: string): boolean {
  const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1)
  if (name.trim() === '') return false
  const dot = name.lastIndexOf('.')
  return dot < 0 || !NON_TEXT_FORMATS.has(name.slice(dot).toLowerCase())
}
