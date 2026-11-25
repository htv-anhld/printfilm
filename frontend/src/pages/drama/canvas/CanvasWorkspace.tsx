/** 画布工作区：React Flow 与 overlay UI 组合 */
import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider, useReactFlow } from '@xyflow/react'
import { CanvasBottomControls } from './CanvasBottomControls'
import { CanvasContextMenu, type CanvasContextMenuState } from './CanvasContextMenu'
import { CanvasLeftToolbar } from './CanvasLeftToolbar'
import { CanvasNodeSelector } from './CanvasNodeSelector'
import { CanvasStoreProvider, useCanvasStore } from './CanvasStore'
import { CanvasTopBar } from './CanvasTopBar'
import { getViewportCenterNodePosition } from './canvasNormalize'
import { CANVAS_NODE_SIZE, type CanvasNodeKind } from './canvasTypes'
import { FreeCanvasFlow } from './FreeCanvasFlow'
import './canvas.css'
import { tr } from '../../../i18n'

type CanvasWorkspaceProps = {
  projectId: number
  /** fullscreen 独立页；embedded 嵌入分集编辑右侧 */
  variant?: 'fullscreen' | 'embedded'
}

/** 渲染画布主体与各区域 overlay */
function CanvasWorkspaceContent({
  projectId,
  variant = 'fullscreen',
}: CanvasWorkspaceProps) {
  const {
    showNodeSelector,
    errorMessage,
    setErrorMessage,
    addNodeOfKind,
    undo,
    redo,
    loading,
  } = useCanvasStore()
  const { screenToFlowPosition } = useReactFlow()
  const embedded = variant === 'embedded'
  // contextMenu 右键菜单位置（null = 关闭）
  const [contextMenu, setContextMenu] = useState<CanvasContextMenuState | null>(null)
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  // 右键菜单选中：节点放在右键点击处（以点击点为节点左上角）
  const handleContextSelect = useCallback(
    (kind: CanvasNodeKind) => {
      if (!contextMenu) return
      const position = screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y })
      void addNodeOfKind(kind, position)
    },
    [addNodeOfKind, contextMenu, screenToFlowPosition],
  )

  const handleSelectNode = useCallback(
    (kind: CanvasNodeKind) => {
      const size = CANVAS_NODE_SIZE[kind]
      const position = getViewportCenterNodePosition(screenToFlowPosition, size)
      void addNodeOfKind(kind, position)
    },
    [addNodeOfKind, screenToFlowPosition],
  )

  /* Ctrl/Cmd+Z / Ctrl+Shift+Z / Ctrl+Y */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (!meta) return
      const key = event.key.toLowerCase()
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undo, redo])

  return (
    <div className={`free-canvas-page${embedded ? ' is-embedded' : ''}`}>
      <FreeCanvasFlow
        projectId={projectId}
        onPaneContextMenu={(event) => setContextMenu({ x: event.clientX, y: event.clientY })}
      />
      <CanvasTopBar variant={variant} />
      <CanvasLeftToolbar onSelectNode={handleSelectNode} />
      <CanvasBottomControls />
      {showNodeSelector ? <CanvasNodeSelector onSelect={handleSelectNode} /> : null}
      {contextMenu ? (
        <CanvasContextMenu menu={contextMenu} onSelect={handleContextSelect} onClose={closeContextMenu} />
      ) : null}
      {errorMessage ? (
        <p className="fc-error-toast" role="alert" onAnimationEnd={() => setErrorMessage('')}>
          {errorMessage}
        </p>
      ) : null}
      {loading ? (
        <p className="fc-error-toast" style={{ background: 'var(--pf-card)', color: 'var(--pf-muted)' }}>
          {tr('episode.canvas.loading')}
        </p>
      ) : null}
    </div>
  )
}

/** 提供 React Flow 与画布状态上下文 */
export function CanvasWorkspace({
  projectId,
  variant = 'fullscreen',
}: CanvasWorkspaceProps) {
  return (
    <CanvasStoreProvider projectId={projectId}>
      <ReactFlowProvider>
        <CanvasWorkspaceContent projectId={projectId} variant={variant} />
      </ReactFlowProvider>
    </CanvasStoreProvider>
  )
}
