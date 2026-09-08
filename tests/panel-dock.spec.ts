// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachPanelDock, panelDockGeometry } from '../src/client/panel-dock.ts'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })

describe('document sidebar space', () => {
  it('leaves room for the native conversation and uses an overlay below the minimum', () => {
    expect(panelDockGeometry(1920, 720, true, false)).toEqual({ width: 720, reserved: 720 })
    expect(panelDockGeometry(1200, 720, true, false)).toEqual({ width: 504, reserved: 504 })
    expect(panelDockGeometry(1056, 720, true, false)).toEqual({ width: 360, reserved: 360 })
    expect(panelDockGeometry(1055, 720, true, false)).toEqual({ width: 720, reserved: 0 })
    expect(panelDockGeometry(320, 720, true, false)).toEqual({ width: 320, reserved: 0 })
    expect(panelDockGeometry(1920, 720, true, true)).toEqual({ width: 1920, reserved: 0 })
    expect(panelDockGeometry(1920, 720, false, false).reserved).toBe(0)
  })

  it('reserves space only while docked and restores the exact prior style on disposal', () => {
    const parent = document.createElement('div')
    const frame = document.createElement('div')
    const layer = document.createElement('div')
    const anchor = document.createElement('span')
    layer.dataset.shellOverlay = ''
    layer.append(anchor); frame.append(layer); parent.append(frame); document.body.append(parent)
    frame.style.setProperty('max-width', '100%', 'important')
    let available = 1920
    vi.spyOn(parent, 'getBoundingClientRect').mockImplementation(() => ({ width: available, left: 20 } as DOMRect))
    vi.spyOn(frame, 'getBoundingClientRect').mockImplementation(() => ({ left: 20, top: 40, height: 900 } as DOMRect))
    const disconnect = vi.fn()
    let resize: () => void = () => {}
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: () => void) { resize = callback }
      observe() {}
      disconnect = disconnect
    })
    const report = vi.fn()
    const dock = attachPanelDock(anchor, report)!
    expect(dock).toBeTruthy()
    dock.update({ open: true, width: 720, maximized: false })
    expect(frame.style.maxWidth).toBe('calc(100% - 720px)')
    expect(report).toHaveBeenLastCalledWith({ left: 1220, top: 40, height: 900, width: 720, reserved: 720 })

    dock.update({ open: true, width: 720, maximized: true })
    expect(frame.style.maxWidth).toBe('100%')
    expect(frame.style.getPropertyPriority('max-width')).toBe('important')
    dock.update({ open: true, width: 720, maximized: false })
    available = 800
    dock.update({ open: true, width: 720, maximized: false })
    expect(frame.style.maxWidth).toBe('100%')
    expect(report.mock.lastCall?.[0]).toMatchObject({ width: 720, reserved: 0 })
    available = 1920
    dock.update({ open: true, width: 720, maximized: false })
    dock.update({ open: false, width: 720, maximized: false })
    expect(frame.style.maxWidth).toBe('100%')
    dock.update({ open: true, width: 720, maximized: false })
    resize() // A queued measurement must die with the contribution.
    const cancel = vi.spyOn(window, 'cancelAnimationFrame')
    dock.dispose()
    expect(cancel).toHaveBeenCalled()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(frame.style.maxWidth).toBe('100%')
    expect(frame.style.getPropertyPriority('max-width')).toBe('important')
    const count = report.mock.calls.length
    dock.update({ open: true, width: 400, maximized: false })
    expect(report).toHaveBeenCalledTimes(count)
  })

  it('does not take ownership of an unknown mount or overwrite a later style owner', () => {
    expect(attachPanelDock(document.createElement('span'), vi.fn())).toBeNull()
    const parent = document.createElement('div')
    parent.innerHTML = '<div><div data-shell-overlay><span></span></div></div>'
    document.body.append(parent)
    vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue({ width: 1920 } as DOMRect)
    const frame = parent.firstElementChild as HTMLElement
    vi.spyOn(frame, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, height: 900 } as DOMRect)
    const dock = attachPanelDock(parent.querySelector('span')!, vi.fn())!
    dock.update({ open: true, width: 720, maximized: false })
    frame.style.maxWidth = '80%'
    dock.dispose()
    expect(frame.style.maxWidth).toBe('80%')
  })
})
