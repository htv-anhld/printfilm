/** 下拉选择器（参照 Dravelio dx-picker）：按钮 + 浮层列表，浮层挂到 body，按视口自动上下翻转 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

export type PickerOption<V extends string | number> = {
  value: V
  label: string
  /** 列表项左侧图标（如模型图块） */
  icon?: ReactNode
  /** 第二行说明 */
  hint?: string
  /** 右上角徽标（如「推荐」） */
  badge?: string
}

type Props<V extends string | number> = {
  /** 按钮左侧图标 */
  icon?: ReactNode
  /** 浮层标题与无障碍名称 */
  title: string
  value: V
  options: PickerOption<V>[]
  onChange: (value: V) => void
  disabled?: boolean
  /** 深色玻璃风格（首页 Hero 内使用） */
  tone?: 'default' | 'glass'
  className?: string
}

type Pos = { left: number; top: number; minWidth: number }

/**
 * 通用选择器
 * - 点击外部 / Esc 关闭，选中后焦点回到按钮
 * - 浮层放不下时翻到按钮上方
 */
export default function OptionPicker<V extends string | number>({
  icon,
  title,
  value,
  options,
  onChange,
  disabled = false,
  tone = 'default',
  className = '',
}: Props<V>) {
  /*
   * open 浮层开关
   * pos 浮层定位
   */
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const current = options.find((o) => o.value === value)

  // 计算浮层位置（优先在下方，空间不足时翻到上方）
  const place = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const r = btn.getBoundingClientRect()
    const pop = popRef.current
    const w = pop?.offsetWidth || r.width
    const h = pop?.offsetHeight || 0
    const below = window.innerHeight - r.bottom - 8
    const top = h > below && r.top - 8 > below ? Math.max(8, r.top - 8 - h) : r.bottom + 8
    const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8)
    setPos({ left, top, minWidth: r.width })
  }, [])

  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (popRef.current?.contains(target) || btnRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      btnRef.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  // 选中一项并关闭
  function pick(next: V) {
    onChange(next)
    setOpen(false)
    btnRef.current?.focus()
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`pf-picker${tone === 'glass' ? ' is-glass' : ''}${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
        title={title}
        aria-label={title}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span className="pf-picker-value">{current?.label ?? String(value)}</span>
        <ChevronDown size={14} className="pf-picker-chevron" aria-hidden />
      </button>
      {open
        ? createPortal(
            <div
              ref={popRef}
              className="pf-picker-pop"
              style={pos ? { left: pos.left, top: pos.top, minWidth: pos.minWidth } : { visibility: 'hidden' }}
            >
              <div className="pf-picker-pop-title">{title}</div>
              <div className="pf-picker-pop-list" role="listbox" aria-label={title}>
                {options.map((o) => {
                  const selected = o.value === value
                  return (
                    <button
                      key={String(o.value)}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`pf-picker-item${selected ? ' is-selected' : ''}`}
                      onClick={() => pick(o.value)}
                    >
                      {o.icon}
                      <span className="pf-picker-item-text">
                        <span className="pf-picker-item-label">
                          {o.label}
                          {o.badge ? <em className="pf-picker-badge">{o.badge}</em> : null}
                        </span>
                        {o.hint ? <span className="pf-picker-item-hint">{o.hint}</span> : null}
                      </span>
                      {selected ? <Check size={15} className="pf-picker-check" aria-hidden /> : null}
                    </button>
                  )
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
