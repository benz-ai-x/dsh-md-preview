/**
 * dsh-md-preview Host entry: registers the MdPreview Remote service. The
 * browser half lives at `./client` (see `dsh.client` in package.json); this
 * module only owns the Host-side read authority.
 */
import type { Context } from '@deepseek-ai/cordis'
import { DEFAULT_ALLOWED_EXTENSIONS, DEFAULT_MAX_BYTES } from './constants.ts'
import { type Config as ConfigType } from './config.ts'
import { MdPreviewService } from './remote.ts'

export { Config } from './config.ts'
export type { Config as ConfigInterface } from './config.ts'
export { DEFAULT_ALLOWED_EXTENSIONS, DEFAULT_MAX_BYTES } from './constants.ts'
export { isAllowedExtension, MdPreviewService } from './remote.ts'
export type { MdPreviewFile, MdPreviewFailureCode, MdPreviewReadRequest } from './protocol.ts'
export { MD_PREVIEW_FAILURE_CODES } from './protocol.ts'

export const name = 'md-preview'

/** Host services the read authority depends on. */
export const inject = ['fs', 'typert', 'sessions']

/**
 * Mount the MdPreview Host Remote.
 * @param ctx - Host Loader context.
 * @param config - Loader-validated deployment configuration (schema defaults
 * fill any fields the profile patch omits).
 */
export function apply(
  ctx: Context,
  config: ConfigType = { maxBytes: DEFAULT_MAX_BYTES, allowedExtensions: [...DEFAULT_ALLOWED_EXTENSIONS] },
): void {
  ctx.plugin(MdPreviewService, config)
}
