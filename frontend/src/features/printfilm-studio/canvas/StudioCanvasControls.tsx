import { tr } from '../../../i18n'
import { useState } from 'react'
import { useReactFlow, useViewport } from '@xyflow/react'
import { Focus, Magnet, Map, Spline } from 'lucide-react'

type StudioCanvasControlsProps = {
  showMap: boolean
  snap: boolean
  showEdges: boolean
  onShowMap: (value: boolean) => void
  onSnap: (value: boolean) => void
  onShowEdges: (value: boolean) => void
}

/** 左下角画布控制：小地图、吸附、连线显隐和缩放菜单。 */
export function StudioCanvasControls({ showMap, snap, showEdges, onShowMap, onSnap, onShowEdges }: StudioCanvasControlsProps) {
  const { fitView, zoomIn, zoomOut, zoomTo } = useReactFlow()
  const { zoom } = useViewport()
  const [menuOpen, setMenuOpen] = useState(false)
  const percent = Math.round(zoom * 100)

  /** 把百分比限制在和参考工作台接近的缩放范围内。 */
  function applyZoom(value: number) {
    const next = Math.min(400, Math.max(20, value))
    void zoomTo(next / 100, { duration: 150 })
  }

  return (
    <div className="pf-studio-controls" role="toolbar" aria-label={tr('studioCanvas.studioCanvasControls.toolbar')}>
      <button type="button" aria-pressed={showMap} aria-label={showMap ? tr('studioCanvas.studioCanvasControls.hideMap') : tr('studioCanvas.studioCanvasControls.showMap')} onClick={() => onShowMap(!showMap)}><Map size={16} /></button>
      <button type="button" aria-pressed={snap} aria-label={snap ? tr('studioCanvas.studioCanvasControls.snapOff') : tr('studioCanvas.studioCanvasControls.snapOn')} onClick={() => onSnap(!snap)}><Magnet size={16} /></button>
      <button type="button" aria-pressed={showEdges} aria-label={showEdges ? tr('studioCanvas.studioCanvasControls.hideEdges') : tr('studioCanvas.studioCanvasControls.showEdges')} onClick={() => onShowEdges(!showEdges)}><Spline size={16} /></button>
      <button type="button" aria-label={tr('studioCanvas.studioCanvasControls.fit')} onClick={() => { void fitView({ duration: 200 }) }}><Focus size={16} /></button>
      <div className="pf-studio-zoom-menu">
        <button type="button" aria-expanded={menuOpen} aria-label={tr('studioCanvas.studioCanvasControls.zoomMenu')} onClick={() => setMenuOpen((open) => !open)}>{percent}%</button>
        {menuOpen ? (
          <div role="menu">
            <label>{tr('studioCanvas.studioCanvasControls.zoom')}<input type="number" min={20} max={400} value={percent} aria-label={tr('studioCanvas.studioCanvasControls.zoomPercent')} onChange={(event) => applyZoom(Number(event.target.value))} />%</label>
            <button type="button" onClick={() => { void zoomIn({ duration: 150 }) }}>{tr('studioCanvas.studioCanvasControls.zoomIn')}</button>
            <button type="button" onClick={() => { void zoomOut({ duration: 150 }) }}>{tr('studioCanvas.studioCanvasControls.zoomOut')}</button>
            <button type="button" onClick={() => { void fitView({ duration: 200 }); setMenuOpen(false) }}>{tr('studioCanvas.studioCanvasControls.fitScreen')}</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
