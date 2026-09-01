/**
 * Browser-safe MdPreview Remote contribution.
 *
 * Hand-maintained twin of the artifacts `@deepseek-ai/dsh-typert-generator`
 * emits for monorepo packages (see `packages/api/session-controller/lib/typert.remote-client.js`
 * in the pinned Harness): one invocation descriptor plus zod strict codecs.
 * The single `mdPreview/read` method takes its session identity as an
 * explicit first business argument (the `goals/*` calling convention), so the
 * browser face works from any client context, not only agent-scoped ones.
 */
import { z } from 'zod'
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { MdPreviewFile, MdPreviewWriteResult } from '../protocol.ts'

/** Browser face of the mounted `mdPreview` Remote namespace. */
export interface MdPreviewRemote {
  /** Read one previewable document of a session's workspace. */
  read(sessionId: SessionId, path: string, signal?: AbortSignal): Promise<RemoteResult<MdPreviewFile>>
  /**
   * Write one previewable document back into a session's workspace. Pass the
   * `fingerprint` from the backing read to guard the save, or `force` to
   * overwrite unconditionally (the conflict prompt's override).
   */
  write(
    sessionId: SessionId,
    path: string,
    content: string,
    fingerprint?: string,
    force?: boolean,
    signal?: AbortSignal,
  ): Promise<RemoteResult<MdPreviewWriteResult>>
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespaceMap {
    /** Markdown preview reads over the Gateway. */
    mdPreview: MdPreviewRemote
  }
}

const readSessionId$schema = z.string()
const readPath$schema = z.string().min(1)
const readResult$schema = z.object({
  path: z.string(),
  content: z.string(),
  fingerprint: z.string(),
})
const writeContent$schema = z.string()
const writeFingerprint$schema = z.string().optional()
const writeForce$schema = z.boolean().optional()
const writeResult$schema = z.object({
  path: z.string(),
  fingerprint: z.string(),
})

/** The MdPreview contribution mounted by this package's browser entry. */
export const TYPERT_REMOTE: TypertRemoteContribution = {
  package: '@benz-ai-x/dsh-md-preview',
  descriptors: [
    {
      id: '@benz-ai-x/dsh-md-preview#mdPreview/read',
      service: 'mdPreview',
      namespace: 'mdPreview',
      method: 'read',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'sessionId',
          wire: 'sessionId',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            schema: readSessionId$schema,
          },
        },
        {
          name: 'path',
          wire: 'path',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@benz-ai-x/dsh-md-preview#mdPreview/read:path',
            schema: readPath$schema,
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: '@benz-ai-x/dsh-md-preview#mdPreview/read:result',
        schema: readResult$schema,
      },
    },
    {
      id: '@benz-ai-x/dsh-md-preview#mdPreview/write',
      service: 'mdPreview',
      namespace: 'mdPreview',
      method: 'write',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'sessionId',
          wire: 'sessionId',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@deepseek-ai/dsh-session/types#SessionId',
            schema: readSessionId$schema,
          },
        },
        {
          name: 'path',
          wire: 'path',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@benz-ai-x/dsh-md-preview#mdPreview/write:path',
            schema: readPath$schema,
          },
        },
        {
          name: 'content',
          wire: 'content',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@benz-ai-x/dsh-md-preview#mdPreview/write:content',
            schema: writeContent$schema,
          },
        },
        {
          name: 'fingerprint',
          wire: 'fingerprint',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@benz-ai-x/dsh-md-preview#mdPreview/write:fingerprint',
            schema: writeFingerprint$schema,
          },
        },
        {
          name: 'force',
          wire: 'force',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@benz-ai-x/dsh-md-preview#mdPreview/write:force',
            schema: writeForce$schema,
          },
        },
      ],
      cancellation: { parameter: 'signal' },
      result: {
        mode: 'strict',
        typeSymbol: '@benz-ai-x/dsh-md-preview#mdPreview/write:result',
        schema: writeResult$schema,
      },
    },
  ],
}

export default TYPERT_REMOTE
