/** 画布左下角缩放与撤销控制条 */
import { useCallback, useState } from 'react'
import { LocateFixed, Magnet, Map, Minus, Plus, Redo2, Scan, Undo2 } from 'lucide-react'
import { useOnViewportChange, useReactFlow } from '@xyflow/react'
import { useCanvasStore } from './CanvasStore'
import { tr } from '../../../i18n'

/** 渲染画布左下角控制条 */
export function CanvasBottomControls() {
  const {
    snapToGrid,
    showMinimap,
    canUndo,
    canRedo,
    toggleSnapToGrid,
    toggleMinimap,
    undo,
    redo,
  } = useCanvasStore()
  const { zoomIn, zoomOut, fitView, setViewport, getViewport } = useReactFlow()
  const [zoomPercent, setZoomPercent] = useState(100)

  useOnViewportChange({
    onChange: (viewport) => {
      setZoomPercent(Math.round(viewport.zoom * 100))
    },
  })

  const handleResetZoom = useCallback(() => {
    const viewport = getViewport()
    void setViewport({ ...viewport, zoom: 1 }, { duration: 200 })
  }, [getViewport, setViewport])

  return (
    <div className="fc-overlay fc-bottom-controls">
      <div className="fc-bottom-bar">
        <button
          type="button"
          className="fc-icon-btn is-sm"
          aria-label={tr('episode.canvas.undo')}
          title={tr('episode.canvas.undo')}
          disabled={!canUndo}
          onClick={undo}
        >
          <Undo2 size={16} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="fc-icon-btn is-sm"
          aria-label={tr('episode.canvas.redo')}
          title={tr('episode.canvas.redo')}
          disabled={!canRedo}
          onClick={redo}
        >
          <Redo2 size={16} strokeWidth={1.8} />
        </button>

        <span className="fc-bottom-sep" />

        <button
          type="button"
          className="fc-icon-btn is-sm"
          aria-label={tr('episode.canvas.focusContent')}
          title={tr('episode.canvas.focusContent')}
          onClick={() => void fitView({ duration: 200 })}
        >
          <LocateFixed size={16} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="fc-icon-btn is-sm"
          aria-label={tr('episode.canvas.fitView')}
          title={tr('episode.canvas.fitView')}
          onClick={() => void fitView({ duration: 200, padding: 0.2 })}
        >
          <Scan size={16} strokeWidth={1.8} />
        </button>

        <span className="fc-bottom-sep" />

        <button
          type="button"
          className={`fc-icon-btn is-sm${snapToGrid ? ' is-active' : ''}`}
          aria-label={snapToGrid ? tr('episode.canvas.snapOff') : tr('episode.canvas.snapOn')}
          title={snapToGrid ? tr('episode.canvas.snapOff') : tr('episode.canvas.snapOn')}
          aria-pressed={snapToGrid}
          onClick={toggleSnapToGrid}
        >
          <Magnet size={16} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className={`fc-icon-btn is-sm${showMinimap ? ' is-active' : ''}`}
          aria-label={showMinimap ? tr('episode.canvas.minimapOff') : tr('episode.canvas.minimapOn')}
          title={showMinimap ? tr('episode.canvas.minimapOff') : tr('episode.canvas.minimapOn')}
          aria-pressed={showMinimap}
          onClick={toggleMinimap}
        >
          <Map size={16} strokeWidth={1.8} />
        </button>

        <span className="fc-bottom-sep" />

        <button
          type="button"
          className="fc-icon-btn is-sm"
          aria-label={tr('episode.canvas.zoomOut')}
          title={tr('episode.canvas.zoomOut')}
          onClick={() => zoomOut({ duration: 150 })}
        >
          <Minus size={16} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          className="fc-zoom-label"
          aria-label={tr('episode.canvas.zoomReset')}
          title={tr('episode.canvas.zoomReset')}
          onClick={handleResetZoom}
        >
          {zoomPercent}%
        </button>
        <button
          type="button"
          className="fc-icon-btn is-sm"
          aria-label={tr('episode.canvas.zoomIn')}
          title={tr('episode.canvas.zoomIn')}
          onClick={() => zoomIn({ duration: 150 })}
        >
          <Plus size={16} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}
