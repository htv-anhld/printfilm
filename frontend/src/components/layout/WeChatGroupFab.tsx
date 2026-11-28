/** 全站右下角：WhatsApp 客服（展示号码，可一键复制或直接打开 WhatsApp；可拖动） */
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, X } from 'lucide-react'
import { useI18n } from '../../i18n'
import { useFabDragPosition } from '../../hooks/useFabDragPosition'
import { WHATSAPP_NUMBER, WHATSAPP_URL } from '../../lib/siteContact'

const POS_STORAGE_KEY = 'pf-wx-group-fab-pos'

/** 客服聊天图标：对话气泡 + 听筒（通用图形，不使用第三方商标） */
function ChatPhoneIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 20.5l1.3-3.9A8.5 8.5 0 1 1 8 19.6Z" />
      <path d="M9.2 8.4c.2-.4.6-.5.9-.3l1 .8c.3.2.3.6.1.9l-.5.6a5.6 5.6 0 0 0 2.9 2.9l.6-.5c.3-.2.7-.2.9.1l.8 1c.2.3.1.7-.3.9-.9.5-2 .6-2.9.2a8 8 0 0 1-3.7-3.7c-.4-.9-.3-2 .2-2.9Z" />
    </svg>
  )
}

export default function WeChatGroupFab() {
  const { t } = useI18n()
  /*
   * open 浮层是否展开
   * copied 复制成功短暂态
   */
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { style: fabStyle, bindDrag, consumeDragSuppressClick } = useFabDragPosition(
    POS_STORAGE_KEY,
    { right: 20, bottom: 24 },
    48,
  )

  // 点击浮层外 / Esc 关闭
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // 复制 WhatsApp 号码到剪贴板
  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(WHATSAPP_NUMBER.replace(/\s+/g, ''))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* 忽略剪贴板失败，用户仍可手动选中复制 */
    }
  }

  return (
    <div className="pf-wx-fab-root is-draggable" ref={rootRef} style={fabStyle}>
      {open ? (
        <div className="pf-wx-fab-panel" role="dialog" aria-label={t('supportChat.title')}>
          <header className="pf-wx-fab-head">
            <div>
              <strong>{t('supportChat.title')}</strong>
              <p>{t('supportChat.lead')}</p>
            </div>
            <button
              type="button"
              className="pf-wx-fab-close"
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          </header>
          <div className="pf-wx-fab-id">
            <span className="pf-wx-fab-id-label">{t('supportChat.idLabel')}</span>
            <code className="pf-wx-fab-id-value">{WHATSAPP_NUMBER}</code>
            <button
              type="button"
              className="pf-wx-fab-copy"
              onClick={() => void copyNumber()}
              aria-label={copied ? t('supportChat.copied') : t('supportChat.copy')}
            >
              {copied ? <Check size={14} strokeWidth={2.2} aria-hidden /> : <Copy size={14} strokeWidth={2} aria-hidden />}
              <span>{copied ? t('supportChat.copied') : t('supportChat.copy')}</span>
            </button>
          </div>
          <a className="pf-wx-fab-open" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} strokeWidth={2} aria-hidden />
            <span>{t('supportChat.openApp')}</span>
          </a>
          <p className="pf-wx-fab-tip">{t('supportChat.tip')}</p>
        </div>
      ) : null}
      <button
        type="button"
        className={`pf-wx-fab-btn is-draggable${open ? ' is-open' : ''}`}
        onClick={() => {
          if (consumeDragSuppressClick()) return
          setOpen((v) => !v)
        }}
        aria-expanded={open}
        aria-label={t('supportChat.open')}
        title={t('supportChat.openDraggable')}
        {...bindDrag}
      >
        <ChatPhoneIcon />
        <span className="pf-wx-fab-label">{t('supportChat.short')}</span>
      </button>
    </div>
  )
}
