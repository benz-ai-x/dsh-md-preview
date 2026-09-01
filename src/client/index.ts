/** Browser entry binding the MdPreview Remote artifact to its Client UI. */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { TYPERT_REMOTE } from '../typert/remote-client.ts'
import { mountMdPreview } from './mount.ts'

export { inject } from './mount.ts'
export type { MdChipsInjected } from './MdChips.tsx'
export type { PreviewActionInjected } from './PreviewAction.tsx'
export type { PreviewOverlayInjected } from './PreviewOverlay.tsx'

/**
 * Mount the MdPreview Remote contribution and its browser UI.
 * @param ctx - client root context.
 * @returns disposer removing the namespace and every UI registration.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  return await mountMdPreview(ctx, TYPERT_REMOTE)
}
