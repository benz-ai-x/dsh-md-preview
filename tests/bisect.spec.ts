// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
describe('bisect', () => { it('imports renderer', () => { expect(SlotRegistry).toBeDefined() }) })
