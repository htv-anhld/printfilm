/** 画布空白处右键菜单：在点击位置添加节点（选项与左侧「+」面板一致） */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ADD_NODE_OPTIONS, type CanvasNodeKind } from './canvasTypes'
import { tr } from '../../../i18n'

export type CanvasContextMenuState = {
  /** 菜单左上角（视口坐标） */
  x: number
  y: number
}

type Props = {
  menu: CanvasContextMenuState
  onSelect: (kind: CanvasNodeKind) => void
  onClose: () => void
}

/**
 * 右键菜单
 * - 点击外部 / Esc / 滚动 / 窗口变化时关闭
 * - 贴近视口边缘时自动往回收，避免被裁掉
 */
export function CanvasContextMenu({ menu, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // pos 修正后的菜单位置
  const [pos, setPos] = useState({ left: menu.x, top: menu.y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { offsetWidth: w, offsetHeight: h } = el
    setPos({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - w - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - h - 8)),
    })
  }, [menu.x, menu.y])

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onClose, { passive: true })
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  // 首个菜单项获得焦点，方便键盘操作
  useEffect(() => {
    ref.current?.querySelector('button')?.focus()
  }, [])

  return (
    <div
      ref={ref}
      className="fc-add-panel fc-context-menu"
      role="menu"
      aria-label={tr('episode.canvas.addNodeType')}
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {ADD_NODE_OPTIONS.map((option) => {
        const Icon = option.icon
        return (
          <button
            key={option.id}
            type="button"
            role="menuitem"
            onClick={() => {
              onSelect(option.id)
              onClose()
            }}
          >
            <span className="fc-add-panel-icon">
              <Icon size={14} strokeWidth={1.8} />
            </span>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
