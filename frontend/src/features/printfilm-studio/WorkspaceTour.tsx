import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { tourLayout, type TourRect } from './canvas/tourLayout'
import './workspaceTour.css'
import { tr } from '../../i18n'

const TOUR_STEPS = [
  { id: 'add', selectors: ['.pf-add-menu', '[aria-label="添加节点"]'] },
  { id: 'canvas', selectors: ['.pf-flow-area'] },
  { id: 'references', selectors: ['.pf-composer-tags', '.react-flow__node.selected:not(.react-flow__node-group)', '[aria-label="项目素材"]'] },
  { id: 'models', selectors: ['.pf-composer-controls', '.pf-default-trigger'] },
  { id: 'agent', selectors: ['.pf-agent-compose', '.pf-canvas-agent'] },
  { id: 'story', selectors: ['.pf-story-plan', '.pf-agent-compose', '.pf-canvas-agent'] },
  { id: 'generate', selectors: ['.pf-composer-go', '.react-flow__node.selected:not(.react-flow__node-group)', '.react-flow__node:not(.react-flow__node-group)', '[aria-label="添加节点"]'] },
  { id: 'history', selectors: ['.pf-top-tools [aria-label="生成历史"]'] },
] as const

/** 文案在读取时按当前语言解析，id / selectors 保持稳定。 */
export const WORKSPACE_TOUR_STEPS = TOUR_STEPS.map(step => ({
  ...step,
  get title() { return tr(`studioCanvas.workspaceTour.step.${step.id}.title`) },
  get text() { return tr(`studioCanvas.workspaceTour.step.${step.id}.text`) },
  get selectors() { return step.selectors.map(localizeSelector) },
}))

/** 选择器里的 aria-label 跟随界面语言（与工作台按钮使用同一组 key）。 */
function localizeSelector(selector: string): string {
  return selector
    .replace('[aria-label="添加节点"]', `[aria-label="${tr('studioCanvas.printfilmStudioPage.addNode')}"]`)
    .replace('[aria-label="项目素材"]', `[aria-label="${tr('studioCanvas.printfilmStudioPage.projectAssets')}"]`)
    .replace('[aria-label="生成历史"]', `[aria-label="${tr('studioCanvas.common.generationHistory')}"]`)
}

type Props = { onClose: () => void; onStep: (id: string) => void }

/** A non-modal spotlight: highlighted controls remain usable; advancing never submits work. */
export function WorkspaceTour({ onClose, onStep }: Props) {
  const [index, setIndex] = useState(0)
  const [target, setTarget] = useState<TourRect | null>(null)
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight })
  const [cardHeight, setCardHeight] = useState(250)
  const card = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null)
  const callbacks = useRef({ onClose, onStep }); callbacks.current = { onClose, onStep }
  const titleId = useId(), descriptionId = useId(), step = WORKSPACE_TOUR_STEPS[index]
  const layout = tourLayout(target, viewport, cardHeight)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopImmediatePropagation(); callbacks.current.onClose()
    }
    window.addEventListener('keydown', escape, true)
    return () => { window.removeEventListener('keydown', escape, true); if (previous?.isConnected) previous.focus() }
  }, [])

  useEffect(() => {
    callbacks.current.onStep(step.id)
    heading.current?.focus({ preventScroll: true })
    let frame = 0, last = ''
    const measure = () => {
      const width = window.innerWidth, height = window.innerHeight
      let next: TourRect | null = null
      for (const selector of step.selectors) {
        for (const element of document.querySelectorAll<HTMLElement>(selector)) {
          const rect = element.getBoundingClientRect()
          if (!rect.width || !rect.height || rect.bottom <= 0 || rect.right <= 0 || rect.top >= height || rect.left >= width || getComputedStyle(element).visibility === 'hidden') continue
          next = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }; break
        }
        if (next) break
      }
      const measuredHeight = card.current?.getBoundingClientRect().height || 250
      const signature = JSON.stringify([next, width, height, measuredHeight])
      if (signature !== last) { last = signature; setTarget(next); setViewport({ width, height }); setCardHeight(measuredHeight) }
      frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [step])

  const focus = layout.focus
  const mask = `M0 0H${viewport.width}V${viewport.height}H0Z` + (focus ? ` M${focus.left} ${focus.top}v${focus.height}h${focus.width}v-${focus.height}Z` : '')
  return createPortal(<div className="pf-workspace-tour" data-step={step.id}>
    <svg className="pf-tour-mask" width={viewport.width} height={viewport.height} aria-hidden="true"><path d={mask} fillRule="evenodd" /></svg>
    {focus && <div className="pf-tour-focus" style={focus} aria-hidden="true" />}
    <section ref={card} className="pf-tour-card" role="dialog" aria-labelledby={titleId} aria-describedby={descriptionId} style={layout.card} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <header><span>{tr('studioCanvas.common.guide')} <b>{index + 1} / {WORKSPACE_TOUR_STEPS.length}</b></span><button type="button" aria-label={tr('studioCanvas.workspaceTour.closeTour')} onClick={onClose}><X size={18} /></button></header>
      <div className="pf-tour-progress" aria-hidden="true">{WORKSPACE_TOUR_STEPS.map((item, at) => <i key={item.id} className={at <= index ? 'is-done' : ''} />)}</div>
      <h2 ref={heading} tabIndex={-1} id={titleId}>{step.title}</h2>
      <p id={descriptionId}>{step.text}</p>
      <small>{target ? tr('studioCanvas.workspaceTour.targetVisible') : tr('studioCanvas.workspaceTour.targetHidden')}</small>
      <footer><button type="button" className="pf-tour-skip" onClick={onClose}>{tr('studioCanvas.workspaceTour.skip')}</button><div><button type="button" disabled={index === 0} onClick={() => setIndex(value => value - 1)}><ArrowLeft size={15} />{tr('studioCanvas.workspaceTour.prev')}</button><button type="button" className="pf-tour-next" onClick={() => index === WORKSPACE_TOUR_STEPS.length - 1 ? onClose() : setIndex(value => value + 1)}>{index === WORKSPACE_TOUR_STEPS.length - 1 ? <>{tr('studioCanvas.workspaceTour.done')}<Check size={15} /></> : <>{tr('studioCanvas.workspaceTour.next')}<ArrowRight size={15} /></>}</button></div></footer>
    </section>
  </div>, document.body)
}
