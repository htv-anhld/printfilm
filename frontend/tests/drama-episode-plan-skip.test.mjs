import test from 'node:test'
import assert from 'node:assert/strict'
import { readEpisodePlanSkip } from '../src/lib/dramaEpisodePlanSkip.ts'

test('读取本集自动分镜跳过记录（版本一致才有效）', () => {
  const script = {
    params: {
      episode_versions: { 2: 3 },
      episode_plan_skips: { 2: { status: 'skipped', reason: 'quá ngắn', units: 432, min_units: 450, version: 3 } },
    },
  }
  assert.deepEqual(readEpisodePlanSkip(script, 2), { status: 'skipped', reason: 'quá ngắn', units: 432, minUnits: 450 })
  assert.equal(readEpisodePlanSkip(script, 1), null)
  assert.equal(readEpisodePlanSkip(null, 2), null)
})

test('正文再保存（版本变化）后旧跳过记录失效', () => {
  const script = {
    params: { episode_versions: { 2: 4 }, episode_plan_skips: { 2: { status: 'skipped', units: 432, min_units: 450, version: 3 } } },
  }
  assert.equal(readEpisodePlanSkip(script, 2), null)
})

test('无版本记录时按 0 比较；非 skipped 状态视为 failed', () => {
  const script = { params: { episode_plan_skips: { 1: { status: 'failed', reason: 'x' } } } }
  assert.equal(readEpisodePlanSkip(script, 1)?.status, 'failed')
})
