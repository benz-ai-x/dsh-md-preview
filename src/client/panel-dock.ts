/** Reversible layout adapter for the pinned shell.overlay DOM (ADR-0004). */

/** Native collapsed navigation (56px) plus the native conversation floor (640px). */
const HOST_MIN_WIDTH = 696
const DOCUMENT_MIN_WIDTH = 360

export interface PanelDockRequest {
  readonly open: boolean
  readonly width: number
  readonly maximized: boolean
}

export interface PanelDockBounds {
  readonly left: number
  readonly top: number
  readonly height: number
  readonly width: number
  readonly reserved: number
}

/** Resolve presentation geometry without changing the reader's width preference. */
export function panelDockGeometry(available: number, requested: number, open: boolean, maximized: boolean): { width: number; reserved: number } {
  const width = maximized ? available : Math.min(requested, available)
  if (!open || maximized || available < HOST_MIN_WIDTH + DOCUMENT_MIN_WIDTH) return { width, reserved: 0 }
  const docked = Math.min(width, available - HOST_MIN_WIDTH)
  return { width: docked, reserved: docked }
}

/** Ownership handle: frame style, geometry observations, and scheduled work share one lifetime. */
export interface PanelDock {
  /** Outside the clipping frame, inside the host root's inert/modal boundary. */
  readonly container: HTMLElement
  update(request: PanelDockRequest): void
  dispose(): void
}

/**
 * Locate only the frame enclosing our own shell contribution. No host DOM is
 * moved and no feature store or slot occupant is replaced. An unknown mount
 * keeps the original overlay presentation instead of guessing a frame.
 */
export function attachPanelDock(anchor: HTMLElement, report: (bounds: PanelDockBounds) => void): PanelDock | null {
  const layer = anchor.closest<HTMLElement>('[data-shell-overlay]')
  const frame = layer?.parentElement
  let parent = frame?.parentElement
  if (frame === undefined || frame === null || parent === undefined || parent === null) return null
  const win = frame.ownerDocument.defaultView
  if (win === null) return null
  // The real Slot renderer wraps root in display:contents. Such wrappers
  // have no box and do not establish the frame's percentage containing block.
  while (win.getComputedStyle(parent).display === 'contents') {
    if (parent.parentElement === null) return null
    parent = parent.parentElement
  }
  const container = parent
  const original = { value: frame.style.getPropertyValue('max-width'), priority: frame.style.getPropertyPriority('max-width') }
  let owned: string | null = null
  let live = true
  let raf: number | null = null
  let request: PanelDockRequest = { open: false, width: 720, maximized: false }
  let last: PanelDockBounds | null = null

  const restore = (): void => {
    if (owned === null) return
    if (frame.style.getPropertyValue('max-width') === owned && frame.style.getPropertyPriority('max-width') === '') {
      if (original.value === '') frame.style.removeProperty('max-width')
      else frame.style.setProperty('max-width', original.value, original.priority)
    }
    owned = null
  }
  const measure = (): void => {
    if (!live) return
    // The renderer's mount container, rather than the already narrowed frame,
    // provides the stable available width. The pinned container has no padding.
    const available = container.getBoundingClientRect().width
    if (available <= 0) { restore(); return }
    const geometry = panelDockGeometry(available, request.width, request.open, request.maximized)
    if (geometry.reserved === 0) restore()
    else {
      const next = `calc(100% - ${geometry.reserved}px)`
      if (owned !== next) { frame.style.setProperty('max-width', next); owned = next }
    }
    const rect = frame.getBoundingClientRect()
    const bounds = { left: rect.left + available - geometry.width, top: rect.top, height: rect.height, ...geometry }
    if (last !== null && Object.keys(bounds).every(key => bounds[key as keyof PanelDockBounds] === last![key as keyof PanelDockBounds])) return
    last = bounds
    report(bounds)
  }
  const schedule = (): void => {
    if (!live || raf !== null) return
    raf = win.requestAnimationFrame(() => { raf = null; measure() })
  }
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
  observer?.observe(container)
  observer?.observe(frame)
  win.addEventListener('resize', schedule, { passive: true })
  win.addEventListener('scroll', schedule, { passive: true, capture: true })
  return {
    container,
    update(next) { if (live) { request = next; measure() } },
    dispose() {
      if (!live) return
      live = false
      observer?.disconnect()
      win.removeEventListener('resize', schedule)
      win.removeEventListener('scroll', schedule, true)
      if (raf !== null) win.cancelAnimationFrame(raf)
      raf = null
      restore()
    },
  }
}
