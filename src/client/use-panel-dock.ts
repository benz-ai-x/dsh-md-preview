import { useLayoutEffect, useRef, useState } from 'react'
import { attachPanelDock, type PanelDock, type PanelDockBounds } from './panel-dock.ts'

/** Bind the frame adapter to the shell contribution's lifetime and local viewing state. */
export function usePanelDock(open: boolean, width: number, maximized: boolean) {
  const anchor = useRef<HTMLSpanElement>(null)
  const adapter = useRef<PanelDock | null>(null)
  const [placement, setPlacement] = useState<{ bounds: PanelDockBounds; container: HTMLElement } | null>(null)
  useLayoutEffect(() => {
    if (anchor.current === null) return
    const dock = attachPanelDock(anchor.current, bounds => {
      if (dock !== null) setPlacement({ bounds, container: dock.container })
    })
    adapter.current = dock
    return () => { adapter.current = null; dock?.dispose() }
  }, [])
  useLayoutEffect(() => { adapter.current?.update({ open, width, maximized }) }, [open, width, maximized])
  return { anchor, bounds: placement?.bounds ?? null, container: placement?.container ?? null }
}
