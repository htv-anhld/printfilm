import { useEffect, useState } from 'react'
import { Check, Copy, Link, UserPlus } from 'lucide-react'
import { WorkspaceDialog } from './WorkspacePanels'
import { projectSharingApi, type ProjectSharing } from './projectSharing'
import { tr } from '../../i18n'

export function SharePanel({ projectId, onClose }: { projectId: number; onClose: () => void }) {
  const [data, setData] = useState<ProjectSharing>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [days, setDays] = useState(7)
  const [created, setCreated] = useState<{ id: string; url: string }>()
  const [copied, setCopied] = useState('')
  const [removing, setRemoving] = useState<number>()
  const projectUrl = `${location.origin}/drama/projects/${projectId}/canvas`
  useEffect(() => {
    let active = true
    void projectSharingApi.get(projectId).then(value => { if (active) setData(value) }).catch(cause => { if (active) setError(cause.message) })
    return () => { active = false }
  }, [projectId])
  async function refresh() { setData(await projectSharingApi.get(projectId)) }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('')
    try { await action(); await refresh() } catch (cause) { setError(cause instanceof Error ? cause.message : tr('studioCanvas.projectSharePanel.actionRetry')) } finally { setBusy(false) }
  }
  async function copy(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(url) } catch { setError(tr('studioCanvas.projectSharePanel.copyFailed')) }
  }
  return <WorkspaceDialog title={tr('studioCanvas.projectSharePanel.title')} onClose={onClose}>
    <div className="pf-share-heading"><div><h3>{tr('studioCanvas.projectSharePanel.projectLink')}</h3><p className="pf-muted">{tr('studioCanvas.projectSharePanel.projectLinkHint')}</p></div><button onClick={() => void copy(projectUrl)}>{copied === projectUrl ? <Check size={16} /> : <Copy size={16} />}{tr('studioCanvas.projectSharePanel.copyLink')}</button></div>
    <input aria-label={tr('studioCanvas.projectSharePanel.projectLink')} readOnly value={projectUrl} />
    <p className="pf-panel-note">{tr('studioCanvas.projectSharePanel.billingNote')}</p>
    {!data && !error && <p role="status">{tr('studioCanvas.projectSharePanel.loadingMembers')}</p>}
    {data?.is_owner && <section className="pf-invite-card">
      <h3><UserPlus size={17} /> {tr('studioCanvas.projectSharePanel.inviteTitle')}</h3>
      <p>{tr('studioCanvas.projectSharePanel.inviteHint')}</p>
      <div className="pf-share-heading"><label>{tr('studioCanvas.projectSharePanel.validity')} <select aria-label={tr('studioCanvas.projectSharePanel.validityAria')} value={days} onChange={event => setDays(Number(event.target.value))}><option value={1}>{tr('studioCanvas.projectSharePanel.days', { n: 1 })}</option><option value={7}>{tr('studioCanvas.projectSharePanel.days', { n: 7 })}</option><option value={30}>{tr('studioCanvas.projectSharePanel.days', { n: 30 })}</option></select></label><button className="pf-primary" disabled={busy} onClick={() => void run(async () => { const invite = await projectSharingApi.invite(projectId, days); setCreated({ id: invite.id, url: `${location.origin}/canvas/join#token=${invite.token}` }); setCopied('') })}><Link size={16} />{tr('studioCanvas.projectSharePanel.createInvite')}</button></div>
      {created && <div><label>{tr('studioCanvas.projectSharePanel.newInvite')}<input aria-label={tr('studioCanvas.projectSharePanel.newInvite')} readOnly value={created.url} /></label><button className="pf-primary" onClick={() => void copy(created.url)}>{copied === created.url ? tr('studioCanvas.projectSharePanel.copied') : tr('studioCanvas.projectSharePanel.copyInvite')}</button><p className="pf-muted">{tr('studioCanvas.projectSharePanel.copyBeforeClose')}</p></div>}
    </section>}
    {data?.is_owner && data.invitations.length > 0 && <section><h3>{tr('studioCanvas.projectSharePanel.manageInvites')}</h3><p className="pf-muted">{tr('studioCanvas.projectSharePanel.revokeHint')}</p><div className="pf-member-list">{data.invitations.map((invite, index) => <article key={invite.id}><span>{tr('studioCanvas.projectSharePanel.inviteN', { n: data.invitations.length - index })}<small>{tr('studioCanvas.projectSharePanel.expiresAt', { time: new Date(invite.expires_at).toLocaleString() })}</small></span><em>{{ active: tr('studioCanvas.projectSharePanel.inv.active'), expired: tr('studioCanvas.projectSharePanel.inv.expired'), revoked: tr('studioCanvas.projectSharePanel.inv.revoked') }[invite.status]}</em>{invite.status === 'active' && <button disabled={busy} onClick={() => void run(async () => { await projectSharingApi.revoke(projectId, invite.id); if (created?.id === invite.id) setCreated(undefined) })}>{tr('studioCanvas.projectSharePanel.revoke')}</button>}</article>)}</div></section>}
    {data && <section><h3>{tr('studioCanvas.projectSharePanel.members', { n: data.members.length })}</h3><div className="pf-member-list">{data.members.map(member => <article key={member.id}><span className="pf-avatar">{member.name.slice(0, 1)}</span><span>{member.name}</span><em>{member.role === 'owner' ? tr('studioCanvas.projectSharePanel.owner') : tr('studioCanvas.projectSharePanel.collaborator')}</em>{data.is_owner && member.role !== 'owner' && <button disabled={busy} onClick={() => setRemoving(member.id)}>{tr('studioCanvas.projectSharePanel.remove')}</button>}</article>)}</div>{removing !== undefined && <div role="alert" className="pf-invite-card"><p>{tr('studioCanvas.projectSharePanel.removeWarn')}</p><button disabled={busy} className="pf-primary" onClick={() => void run(async () => { await projectSharingApi.remove(projectId, removing); setRemoving(undefined) })}>{tr('studioCanvas.projectSharePanel.confirmRemove')}</button> <button disabled={busy} onClick={() => setRemoving(undefined)}>{tr('studioCanvas.common.cancel')}</button></div>}{!data.is_owner && <p className="pf-muted">{tr('studioCanvas.projectSharePanel.ownerManages')}</p>}</section>}
    {error && <p role="alert">{error}</p>}
  </WorkspaceDialog>
}
