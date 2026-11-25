/** 模型图块：彩色方块 + 厂商首字母（视频模型选择器用） */
type Family = 'seedance' | 'minimax' | 'kling' | 'veo' | 'other'

// 按模型 id 判断厂商（决定图块配色与字母）
function modelFamily(id: string): Family {
  const s = id.toLowerCase()
  if (s.includes('seedance')) return 'seedance'
  if (s.includes('minimax') || s.includes('hailuo')) return 'minimax'
  if (s.includes('kling')) return 'kling'
  if (s.includes('veo')) return 'veo'
  return 'other'
}

const FAMILY_MARK: Record<Family, string> = {
  seedance: 'S',
  minimax: 'M',
  kling: 'K',
  veo: 'V',
  other: '•',
}

/** 模型图块 */
export default function ModelTile({ modelId, size = 'md' }: { modelId: string; size?: 'sm' | 'md' }) {
  const family = modelFamily(modelId)
  return (
    <span className={`pf-model-tile is-${family} is-${size}`} aria-hidden>
      {FAMILY_MARK[family]}
    </span>
  )
}

