/** 上传剧本文件区（参照 Dravelio「Tư liệu gốc」）：拖拽 / 点选 .txt .md .docx .pdf，附样例下载 */
import { useRef, useState, type DragEvent } from 'react'
import { BookOpen, Download, FileText, X } from 'lucide-react'
import { useI18n } from '../../i18n'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = '.txt,.md,.docx,.pdf'
const ALLOWED = ['.txt', '.md', '.docx', '.pdf']

type Props = {
  file: File | null
  onFileChange: (file: File | null) => void
  onError: (message: string) => void
  disabled?: boolean
}

// 文件大小展示
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** 拖拽区 + 已选文件卡 + 样例下载 */
export default function DramaScriptUpload({ file, onFileChange, onError, disabled }: Props) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  // dragging 拖拽悬停态
  const [dragging, setDragging] = useState(false)

  // 校验并接收文件
  function accept(next: File | undefined) {
    if (!next) return
    const name = next.name.toLowerCase()
    if (!ALLOWED.some((ext) => name.endsWith(ext))) {
      onError(t('scriptImport.badType'))
      return
    }
    if (next.size > MAX_BYTES) {
      onError(t('scriptImport.tooLarge'))
      return
    }
    onError('')
    onFileChange(next)
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    if (!disabled) accept(e.dataTransfer.files?.[0])
  }

  // 下载样例剧本（前端生成 txt）
  function downloadSample() {
    const blob = new Blob([t('scriptImport.sampleText')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = t('scriptImport.sampleFile')
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="drama-upload">
      <div className="drama-upload-head">
        <span>{t('scriptImport.sourceKicker')}</span>
        <span>{t('scriptImport.formats')}</span>
      </div>
      <div
        className={`drama-upload-drop${dragging ? ' is-dragging' : ''}${file ? ' has-file' : ''}`}
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {file ? (
          <div className="drama-upload-file">
            <span className="drama-upload-file-icon" aria-hidden>
              <FileText size={22} />
            </span>
            <span className="drama-upload-file-text">
              <strong>{file.name}</strong>
              <small>{formatSize(file.size)}</small>
            </span>
            <button
              type="button"
              className="drama-upload-remove"
              aria-label={t('scriptImport.removeFile')}
              title={t('scriptImport.removeFile')}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
                onFileChange(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <span className="drama-upload-icon" aria-hidden>
              <BookOpen size={22} />
            </span>
            <strong>{t('scriptImport.dropTitle')}</strong>
            <small>{t('scriptImport.dropHint')}</small>
            <span className="drama-upload-choose">{t('scriptImport.chooseFile')}</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={ACCEPT}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      <p className="drama-upload-hint">{t('scriptImport.splitHint')}</p>
      <button type="button" className="drama-upload-sample" onClick={downloadSample}>
        <Download size={13} aria-hidden />
        {t('scriptImport.sample')}
      </button>
    </div>
  )
}
