import { tr } from '../../../i18n'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, Check, ChevronRight, Copy, GitBranch, Pencil, Sparkles, Trash2, Wrench } from 'lucide-react'
import { MessageContent } from './MessageContent'
import { AgentReferences } from './AgentReferences'
import { AgentProgress } from './AgentProgress'
import { ProposalCard, type ProposalControls } from './ProposalCard'
import type { AgentProposal } from './proposals'
import { conversationDisplayRows, type AgentEvent } from './conversation'

export type MessageAction = 'branch' | 'edit_branch' | 'truncate'
export function AgentConversation({ events, answer, running, sessionId, labels, onPrompt, onAction, guide, proposals }: {
  events: AgentEvent[]; answer: string; running: boolean; sessionId: string | null; labels: Record<string, string>
  onPrompt: (value: string) => void; onAction: (event: AgentEvent, action: MessageAction) => Promise<void>
  guide?: ReactNode
  proposals?: ProposalControls
}) {
  const log = useRef<HTMLDivElement | null>(null)
  const atBottom = useRef(true)
  const [unread, setUnread] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollBottom = () => { if (log.current) log.current.scrollTop = log.current.scrollHeight; atBottom.current = true; setUnread(false) }
  useEffect(() => { atBottom.current = true; setUnread(false) }, [sessionId])
  useEffect(() => { if (atBottom.current) scrollBottom(); else setUnread(true) }, [events, answer])
  const rows = conversationDisplayRows(events, running, answer)
  const act = async (event: AgentEvent, action: MessageAction) => {
    if (action === 'truncate' && !window.confirm(tr('studioCanvas.agentConversation.confirmTruncate'))) return
    setBusy(true); setError('')
    try { await onAction(event, action) } catch (reason) { setError(reason instanceof Error ? reason.message : tr('studioCanvas.agentConversation.actionFailed')) } finally { setBusy(false) }
  }
  return <div className="pf-agent-thread">
    {guide}
    <div className="pf-agent-scroll pf-agent-conversation" ref={log} role="log" aria-live="polite" onScroll={() => { const element = log.current; if (element) { atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 48; if (atBottom.current) setUnread(false) } }}>
      {events.length === 0 && <div className="pf-agent-welcome"><Sparkles size={28} /><h3>{tr('studioCanvas.agentConversation.welcome')}</h3><p>{tr('studioCanvas.agentConversation.welcomeHint')}</p>{[
        [tr('studioCanvas.agentConversation.outlineCanvas'), tr('studioCanvas.agentConversation.outlineCanvasHint')], [tr('studioCanvas.agentConversation.planShots'), tr('studioCanvas.agentConversation.planShotsHint')], [tr('studioCanvas.agentConversation.editVideo'), tr('studioCanvas.agentConversation.editVideoHint')],
      ].map(([title, description]) => <button key={title} onClick={() => onPrompt(description)}><span><b>{title}</b><small>{description}</small></span><ChevronRight size={15} /></button>)}</div>}
      {rows.map((event, index) => event.type === 'proposal' && proposals ? <ProposalCard key={(event.data as AgentProposal).id} proposal={event.data as AgentProposal} controls={proposals} /> : event.type.startsWith('tool_') ? <details className={`pf-agent-tool ${event.state === 'failed' ? 'is-error' : ''}`} key={index}>
        <summary><ChevronRight className="pf-disclosure" size={14} /><Wrench size={14} /><span title={event.text}>{labels[event.text] || event.text}</span><em>{event.state === 'running' ? tr('studioCanvas.agentConversation.running') : event.state === 'failed' ? tr('studioCanvas.agentConversation.failed') : event.state === 'interrupted' ? tr('studioCanvas.agentConversation.interrupted') : tr('studioCanvas.agentConversation.done')}</em></summary>
        {event.input !== undefined && <><small>{tr('studioCanvas.agentConversation.input')}</small><pre>{JSON.stringify(event.input, null, 2)}</pre></>}
        {event.summary && <p>{event.summary}</p>}{event.data !== undefined && <><small>{tr('studioCanvas.agentConversation.result')}</small><pre>{JSON.stringify(event.data, null, 2)}</pre></>}
      </details> : event.type === 'thinking' ? <details className="pf-agent-tool" key={index}><summary><ChevronRight className="pf-disclosure" size={14} /><Sparkles size={14} />{tr('studioCanvas.agentConversation.progress')}</summary><p>{event.text}</p></details> : <div className={`pf-agent-bubble is-${event.type}${event.streaming ? ' is-streaming' : ''}`} key={event.streaming ? 'streaming' : index}>
        {event.references && <AgentReferences references={event.references} />}
        {event.text && <MessageContent text={event.text} />}
        {!event.streaming && ['user', 'assistant'].includes(event.type) && <div className="pf-message-actions">
          <button aria-label={tr('studioCanvas.agentConversation.copy')} title={tr('studioCanvas.agentConversation.copy')} onClick={() => void navigator.clipboard.writeText(event.text).then(() => setCopied(index)).catch(() => setError(tr('studioCanvas.agentConversation.copyFailed')))}>{copied === index ? <Check size={14} /> : <Copy size={14} />}</button>
          {event.id && <><button title={tr('studioCanvas.agentConversation.branchTitle')} aria-label={tr('studioCanvas.agentConversation.branch')} disabled={running || busy} onClick={() => void act(event, 'branch')}><GitBranch size={14} /></button>
            {event.type === 'user' && <button title={tr('studioCanvas.agentConversation.editTitle')} aria-label={tr('studioCanvas.agentConversation.edit')} disabled={running || busy} onClick={() => void act(event, 'edit_branch')}><Pencil size={14} /></button>}
            <button title={tr('studioCanvas.agentConversation.truncate')} aria-label={tr('studioCanvas.agentConversation.truncate')} disabled={running || busy} onClick={() => void act(event, 'truncate')}><Trash2 size={14} /></button></>}
        </div>}
      </div>)}
      {error && <p role="alert" className="pf-agent-error">{error}</p>}
    </div>
    {running && <AgentProgress events={events} labels={labels} />}
    {unread && <button className="pf-agent-jump" onClick={scrollBottom}><ArrowDown size={14} />{tr('studioCanvas.agentConversation.scrollBottom')}</button>}
  </div>
}
