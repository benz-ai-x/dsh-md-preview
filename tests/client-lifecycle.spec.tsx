// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { mountSidebar } from './sidebar-harness.tsx'

describe('native Markdown activation', () => {
  it('rolls Remote and styles back when a UI contribution cannot register', async () => {
    let events!: string[]
    await expect(mountSidebar({ beforePlugin(runtime, calls) {
      events = calls
      vi.spyOn(runtime.slots, 'register').mockImplementationOnce(() => {
        expect(events).toEqual(['mount'])
        throw new Error('registration unavailable')
      })
    } })).rejects.toThrow('registration unavailable')
    expect(events).toEqual(['mount', 'unmount'])
    expect(document.querySelector('[data-plugin-css="md-preview"]')).toBeNull()
  })

  it('declines an unpatched sidebar before exposing an editor that cannot guard close', async () => {
    let events!: string[]
    await expect(mountSidebar({ beforePlugin(runtime, calls) {
      events = calls
      Object.defineProperty(runtime.ctx.sidebarRight, 'beforeClose', { value: undefined, configurable: true })
    } })).rejects.toThrow('sidebarRight.beforeClose')
    expect(events).toEqual(['mount', 'unmount'])
    expect(document.querySelector('[data-plugin-css="md-preview"]')).toBeNull()
  })
})
