import { lazy, Suspense, useEffect, useState } from 'react'
import { isPrintfilmStudioEnabled } from '../../../features/printfilm-studio/featureFlag'
import CanvasPage from './CanvasPage'

const PrintfilmStudioPage = lazy(() => import('../../../features/printfilm-studio/PrintfilmStudioPage'))

/**
 * 项目画布入口：后端开启 Printfilm Studio（PRINTFILM_STUDIO_ENABLED）时用上游新画布，
 * 否则回到本分支的自由画布（右键菜单等），避免新画布接口未开启时整页 404。
 */
export default function CanvasRoute() {
  // enabled 能力检测结果：null 表示仍在检测
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    let active = true
    void isPrintfilmStudioEnabled()
      .then((value) => active && setEnabled(value))
      .catch(() => active && setEnabled(false))
    return () => { active = false }
  }, [])
  if (enabled === null) return null
  if (!enabled) return <CanvasPage />
  return <Suspense fallback={null}><PrintfilmStudioPage /></Suspense>
}
