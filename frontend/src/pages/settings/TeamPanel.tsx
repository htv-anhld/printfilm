import { useCallback, useEffect, useState } from 'react'
import { api, type PlanInterval, type TeamDetail, type TeamMemberRow, type TeamSummary } from '../../api'
import { useI18n } from '../../i18n'
import { dialog } from '../../lib/dialog'
import { formatMoney, useBillingConfig } from '../../lib/money'

/** 金额输入（主单位，如 $ 12.5）→ 最小单位 */
function parseMajor(raw: string | null): number {
  const v = Number(String(raw || '').replace(',', '.'))
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : 0
}

/** 个人中心「团队」：创建团队、成员与邀请、额度分配、购买席位 */
export default function TeamPanel() {
  const { t } = useI18n()
  useBillingConfig()
  /* 我的团队与当前选中团队 */
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [team, setTeam] = useState<TeamDetail | null>(null)
  /* 表单 */
  const [newName, setNewName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [inviteLink, setInviteLink] = useState('')
  const [seats, setSeats] = useState(5)
  const [interval, setPlanInterval] = useState<PlanInterval>('month')
  /* 状态 */
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadTeam = useCallback(async (id: number) => {
    setTeam(await api.team(id))
  }, [])

  const loadTeams = useCallback(async () => {
    const res = await api.myTeams()
    setTeams(res.items)
    if (res.items[0]) await loadTeam(res.items[0].id)
  }, [loadTeam])

  useEffect(() => {
    loadTeams().catch((e) => setError(e instanceof Error ? e.message : t('common.fail')))
  }, [loadTeams, t])

  // 包一层：统一 busy / 错误 / 刷新
  async function run(fn: () => Promise<unknown>, refresh = true) {
    setBusy(true)
    setError('')
    try {
      await fn()
      if (refresh && team) await loadTeam(team.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
    } finally {
      setBusy(false)
    }
  }

  const canManage = team?.my_role === 'owner' || team?.my_role === 'admin'
  const isOwner = team?.my_role === 'owner'

  async function allocate(member: TeamMemberRow, reclaim = false) {
    if (!team) return
    const raw = await dialog.prompt({
      title: reclaim ? t('team.reclaimTitle') : t('team.allocateTitle'),
      message: t(reclaim ? 'team.reclaimMessage' : 'team.allocateMessage', { email: member.email }),
      placeholder: '10',
    })
    const amount = parseMajor(raw)
    if (!amount) return
    await run(() =>
      reclaim ? api.reclaimTeamCredits(team.id, member.user_id, amount) : api.allocateTeamCredits(team.id, member.user_id, amount),
    )
  }

  async function remove(member: TeamMemberRow) {
    if (!team) return
    const ok = await dialog.confirm({
      title: t('team.removeTitle'),
      message: t('team.removeMessage', { email: member.email }),
      tone: 'danger',
    })
    if (ok) await run(() => api.removeTeamMember(team.id, member.user_id))
  }

  return (
    <section className="pf-settings-card">
      <h1>{t('settings.tabs.team')}</h1>
      <p className="pf-muted">{t('team.lead')}</p>
      {error ? <p className="pf-error">{error}</p> : null}

      {teams.length > 1 ? (
        <div className="pf-team-switch">
          {teams.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`pf-btn pf-btn-sm ${team?.id === item.id ? 'pf-btn-lime' : 'pf-btn-ghost'}`}
              onClick={() => void loadTeam(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
      ) : null}

      {!team ? (
        <div className="pf-api-create">
          <input value={newName} maxLength={64} placeholder={t('team.namePlaceholder')} onChange={(e) => setNewName(e.target.value)} />
          <button
            type="button"
            className="pf-btn pf-btn-lime pf-btn-sm"
            disabled={busy || !newName.trim()}
            onClick={() =>
              void run(async () => {
                const created = await api.createTeam(newName.trim())
                setTeam(created)
                setTeams([{ id: created.id, name: created.name, role: 'owner', seats: created.seats, members: 1, owner_id: created.owner_id }])
              }, false)
            }
          >
            {t('team.create')}
          </button>
        </div>
      ) : (
        <>
          <p className="pf-team-meta">
            <strong>{team.name}</strong> · {t('team.seats', { used: team.members.length, total: team.seats })} ·{' '}
            {t(`team.role.${team.my_role}`)}
          </p>

          <ul className="pf-settings-list">
            {team.members.map((m) => (
              <li key={m.user_id}>
                <div className="pf-settings-list-row">
                  <span className="pf-settings-list-main">
                    <strong>{m.nickname || m.email}</strong>
                    <em className="pf-muted">
                      {m.email} · {t(`team.role.${m.role}`)}
                      {canManage && m.balance_fen !== undefined
                        ? ` · ${t('team.memberStats', {
                            balance: formatMoney(m.balance_fen),
                            month: formatMoney(m.month_charge_fen),
                            allocated: formatMoney(m.allocated_fen),
                          })}`
                        : ''}
                    </em>
                  </span>
                  {canManage && m.role !== 'owner' ? (
                    <span className="pf-team-actions">
                      <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" disabled={busy} onClick={() => void allocate(m)}>
                        {t('team.allocate')}
                      </button>
                      <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" disabled={busy} onClick={() => void allocate(m, true)}>
                        {t('team.reclaim')}
                      </button>
                      {isOwner ? (
                        <button
                          type="button"
                          className="pf-btn pf-btn-ghost pf-btn-sm"
                          disabled={busy}
                          onClick={() => void run(() => api.setTeamRole(team.id, m.user_id, m.role === 'admin' ? 'member' : 'admin'))}
                        >
                          {m.role === 'admin' ? t('team.makeMember') : t('team.makeAdmin')}
                        </button>
                      ) : null}
                      <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" disabled={busy} onClick={() => void remove(m)}>
                        {t('team.remove')}
                      </button>
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {canManage ? (
            <>
              <h3>{t('team.inviteTitle')}</h3>
              <div className="pf-api-create">
                <input
                  type="email"
                  value={inviteEmail}
                  placeholder={t('team.invitePlaceholder')}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}>
                  <option value="member">{t('team.role.member')}</option>
                  <option value="admin">{t('team.role.admin')}</option>
                </select>
                <button
                  type="button"
                  className="pf-btn pf-btn-lime pf-btn-sm"
                  disabled={busy || !inviteEmail.trim()}
                  onClick={() =>
                    void run(async () => {
                      const res = await api.inviteTeamMember(team.id, inviteEmail.trim(), inviteRole)
                      setInviteLink(res.link)
                      setInviteEmail('')
                    })
                  }
                >
                  {t('team.invite')}
                </button>
              </div>
              {inviteLink ? (
                <div className="pf-api-secret">
                  <p>{t('team.inviteLinkHint')}</p>
                  <code>{inviteLink}</code>
                </div>
              ) : null}
              {team.invites.length > 0 ? (
                <ul className="pf-settings-list">
                  {team.invites.map((inv) => (
                    <li key={inv.id}>
                      <div className="pf-settings-list-row">
                        <span className="pf-settings-list-main">
                          <strong>{inv.email}</strong>
                          <em className="pf-muted">
                            {t(`team.role.${inv.role}`)} · {inv.expired ? t('team.inviteExpired') : t('team.invitePending')}
                          </em>
                        </span>
                        <button
                          type="button"
                          className="pf-btn pf-btn-ghost pf-btn-sm"
                          disabled={busy}
                          onClick={() => void run(() => api.revokeTeamInvite(team.id, inv.id))}
                        >
                          {t('team.revoke')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          {isOwner ? (
            <div className="pf-team-seats">
              <h3>{t('team.seatsTitle')}</h3>
              <p className="pf-muted">{t('team.seatsLead', { credits: formatMoney(team.credits_per_seat) })}</p>
              <div className="pf-api-create">
                <input type="number" min={Math.max(1, team.members.length)} max={500} value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
                <select value={interval} onChange={(e) => setPlanInterval(e.target.value as PlanInterval)}>
                  <option value="month">{t('pricing.plans.month')}</option>
                  <option value="year">{t('pricing.plans.year')}</option>
                </select>
                <button
                  type="button"
                  className="pf-btn pf-btn-lime pf-btn-sm"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const res = await api.teamSeatsCheckout(team.id, seats, interval)
                      window.location.assign(res.checkout_url)
                    }, false)
                  }
                >
                  {t('team.buySeats')}
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
