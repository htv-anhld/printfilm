import { tr } from '../../../i18n'
import { useEffect, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { conversationRows, type AgentEvent } from './conversation'

export function AgentProgress({ events, labels }: { events: AgentEvent[]; labels: Record<string, string> }) {
  const [started] = useState(() => Date.now())
  const [seconds, setSeconds] = useState(0)
  useEffect(() => { const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000); return () => window.clearInterval(timer) }, [started])
  const current = events.slice(events.findLastIndex((event) => event.type === 'user') + 1)
  const pending = conversationRows(current, true).findLast((event) => event.state === 'running')
  const phase = current.findLast(event => event.type === 'model_progress')?.text
  return <div className="pf-agent-progress">
    <LoaderCircle size={16} className="pf-agent-progress-spinner" />
    <div role="status"><b>{tr('studioCanvas.agentProgress.generating')}{pending ? ` · ${labels[pending.text] || tr('studioCanvas.agentProgress.processingCanvas')}` : '…'}</b><small>{pending ? tr('studioCanvas.agentProgress.readingCanvas') : phase || (seconds >= 30 ? tr('studioCanvas.agentProgress.waitingModel') : tr('studioCanvas.agentProgress.composing'))}</small></div>
    <time aria-label={tr('studioCanvas.agentProgress.waited', { seconds })}>{seconds < 60 ? tr('studioCanvas.agentProgress.seconds', { seconds }) : tr('studioCanvas.agentProgress.minutes', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })}</time>
  </div>
}
