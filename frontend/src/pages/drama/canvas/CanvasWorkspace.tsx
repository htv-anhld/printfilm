import { TeamEditingBoundary } from '../../../features/teams/TeamEditingBoundary'
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
import { formatGenerationErrorMessage } from '../../../lib/generationError'
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
    flushSave,
  } = useCanvasStore()
  const { screenToFlowPosition, getNodes } = useReactFlow()
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
      /* 视口中心已有节点时阶梯错开，避免连续添加的节点完全叠在一起 */
      const others = getNodes()
      const overlaps = (x: number, y: number) =>
        others.some((n) => {
          const w = n.measured?.width ?? n.width ?? 200
          const h = n.measured?.height ?? n.height ?? 240
          return x < n.position.x + w && x + size.width > n.position.x && y < n.position.y + h && y + size.height > n.position.y
        })
      for (let i = 0; i < 12 && overlaps(position.x, position.y); i++) {
        position.x += size.width / 2 + 40
        position.y += 40
      }
      void addNodeOfKind(kind, position)
    },
    [addNodeOfKind, getNodes, screenToFlowPosition],
  )

  /* Ctrl/Cmd+S 保存；Ctrl/Cmd+Z / Ctrl+Shift+Z / Ctrl+Y 撤销重做 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      if (!meta) return
      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        void flushSave()
        return
      }
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
  }, [undo, redo, flushSave])

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
          {formatGenerationErrorMessage(errorMessage)}
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
    <TeamEditingBoundary projectId={projectId} type="canvas" resourceId={0}><CanvasStoreProvider projectId={projectId}>
      <ReactFlowProvider>
        <CanvasWorkspaceContent projectId={projectId} variant={variant} />
      </ReactFlowProvider>
    </CanvasStoreProvider></TeamEditingBoundary>
  )
}
