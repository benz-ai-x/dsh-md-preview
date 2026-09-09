/** Explicit file-session RPC boundary shared by document owners and adapters. */
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewFile, MdPreviewWriteResult } from '../protocol.ts'

export interface MarkdownDocumentApi {
  read(sessionId: SessionId, path: string, signal: AbortSignal): Promise<RemoteResult<MdPreviewFile>>
  write(sessionId: SessionId, path: string, content: string, fingerprint: string | undefined,
    force: boolean, signal: AbortSignal): Promise<RemoteResult<MdPreviewWriteResult>>
}
