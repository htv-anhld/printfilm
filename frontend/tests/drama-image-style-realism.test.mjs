import assert from 'node:assert/strict'
import test from 'node:test'
import {
  IMAGE_STYLE_IDS,
  IMAGE_STYLE_REALISTIC,
  isRealisticImageStyle,
  shouldWarnRealisticStyle,
} from '../src/lib/dramaImageStyles.ts'
import { formatDramaGenError } from '../src/lib/dramaGenError.ts'
import { tr } from '../src/i18n'

test('every built-in style is tagged realistic or illustrated', () => {
  assert.deepEqual(Object.keys(IMAGE_STYLE_REALISTIC).sort(), [...IMAGE_STYLE_IDS].sort())
  for (const id of IMAGE_STYLE_IDS) assert.equal(typeof IMAGE_STYLE_REALISTIC[id], 'boolean')
  assert.equal(isRealisticImageStyle('chinese-urban-realistic'), true)
  assert.equal(isRealisticImageStyle('ancient-romance-soft'), true)
  assert.equal(isRealisticImageStyle('ghibli-handdrawn-anime'), false)
  assert.equal(isRealisticImageStyle(''), false)
  assert.equal(isRealisticImageStyle('constructor'), false)
})

test('realistic warning only applies to Seedance video models', () => {
  assert.equal(shouldWarnRealisticStyle('wuxia-realistic-photo', 'seedance-2.5'), true)
  assert.equal(shouldWarnRealisticStyle('wuxia-realistic-photo', 'MiniMax-H3'), false)
  assert.equal(shouldWarnRealisticStyle('cgi-3d-animation', 'seedance-2.0'), false)
  assert.equal(shouldWarnRealisticStyle('', 'seedance-2.0'), false)
})

test('privacy rejection with realistic project style suggests switching the project style', () => {
  const raw = '参考图疑似真人：角色「林晚」（content[1]，PrivacyInformation），请更换该形象为动漫或插画后重试。当前项目画面风格「国产都市写实」是真人写实风格，Seedance 容易把这类角色图判为真人而拒绝生成'
  const out = formatDramaGenError(raw)
  assert.equal(out.suggestion, tr('lib.genError.realPerson.styleSuggestion'))
  const plain = formatDramaGenError('参考图疑似真人（PrivacyInformation），请更换角色/场景形象为动漫或插画后重试')
  assert.equal(plain.suggestion, tr('lib.genError.realPerson.suggestion'))
})
