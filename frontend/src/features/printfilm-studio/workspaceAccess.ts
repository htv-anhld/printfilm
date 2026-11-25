import { isRequestAborted } from '../../api/http.ts'
import { tr } from '../../i18n/translate.ts'

export const STUDIO_SESSION_EXPIRED = 'pf-studio-session-expired'
export type WorkspaceIssue = { title: string; message: string; action: 'login' | 'retry' | 'back' }

export function workspaceIssue(cause: unknown): WorkspaceIssue {
  const status = cause && typeof cause === 'object' && 'status' in cause ? cause.status : undefined
  if (status === 401) return { title: tr('studioCanvas.workspaceAccess.expiredTitle'), message: tr('studioCanvas.workspaceAccess.expiredMessage'), action: 'login' }
  if (status === 403 || status === 404) return { title: tr('studioCanvas.workspaceAccess.forbiddenTitle'), message: tr('studioCanvas.workspaceAccess.forbiddenMessage'), action: 'back' }
  return { title: tr('studioCanvas.workspaceAccess.loadFailedTitle'), message: cause instanceof Error ? cause.message : tr('studioCanvas.workspaceAccess.loadFailedMessage'), action: 'retry' }
}

export function canEditStudioCanvas(validProjectId: boolean, canvasReady: boolean, lockReadOnly: boolean, sessionExpired: boolean): boolean {
  return validProjectId && canvasReady && !lockReadOnly && !sessionExpired
}

export function studioLoginPath(path: string): string {
  return `/auth?next=${encodeURIComponent(path)}`
}

/** An old request must not expire a newer login, including across tabs. */
export function reportStudioUnauthorized(cause: unknown, token: string | null, getToken: () => string | null, notify: () => void): void {
  if (token && token === getToken() && cause && typeof cause === 'object' && 'status' in cause && cause.status === 401) notify()
}

/** Resolve the project's real workspace before reading its canvas. Never apply a late response. */
export async function loadStudioCanvas<T>(options: {
  syncWorkspace: () => Promise<unknown>
  loadCanvas: () => Promise<T>
  isCurrent: () => boolean
  onReady: (result: T) => void
  onError: (issue: WorkspaceIssue) => void
}): Promise<void> {
  try {
    await options.syncWorkspace()
    if (!options.isCurrent()) return
    const result = await options.loadCanvas()
    if (options.isCurrent()) options.onReady(result)
  } catch (cause) {
    if (options.isCurrent() && !isRequestAborted(cause)) options.onError(workspaceIssue(cause))
  }
}
