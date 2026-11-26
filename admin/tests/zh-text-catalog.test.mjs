import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { applyLocale } from '../src/i18n/detect.ts'
import { tz, zhLazy, zhTextCatalogs } from '../src/i18n/zhText.ts'

const placeholders = value => (value.match(/\{\w+\}/g) || []).sort().join()

// 源码中 tz("…") 的字面量都要有 vi / en 译文
function sourceKeys() {
  const root = new URL('../src/', import.meta.url).pathname
  const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'locales' ? [] : walk(join(dir, e.name))) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [])
  const keys = new Set()
  for (const file of walk(root)) for (const m of readFileSync(file, 'utf8').matchAll(/\btz\(\s*("(?:[^"\\]|\\.)*")/g)) keys.add(JSON.parse(m[1]))
  return keys
}

test('zh-keyed catalogs cover every tz() literal with matching placeholders and no CJK', () => {
  const { en, vi } = zhTextCatalogs
  assert.deepEqual(Object.keys(vi).sort(), Object.keys(en).sort())
  for (const key of sourceKeys()) { assert.ok(en[key], `missing en: ${key}`); assert.ok(vi[key], `missing vi: ${key}`) }
  for (const [name, table] of [['en', en], ['vi', vi]]) for (const [key, value] of Object.entries(table)) {
    assert.doesNotMatch(value, /[㐀-鿿]/, `CJK in ${name}: ${key}`)
    assert.equal(placeholders(value), placeholders(key), `placeholders ${name}: ${key}`)
  }
})

test('tz and zhLazy resolve the locale at read time', () => {
  const table = zhLazy({ draft: '草稿', nested: { pending: '待审核' } })
  applyLocale('zh', false)
  assert.equal(table.draft, '草稿')
  assert.equal(tz('用户 #{0}', [7]), '用户 #7')
  applyLocale('vi', false)
  assert.equal(table.draft, zhTextCatalogs.vi['草稿'])
  assert.equal(table.nested.pending, zhTextCatalogs.vi['待审核'])
  assert.doesNotMatch(tz('用户 #{0}', [7]), /[㐀-鿿]/)
  assert.equal(tz('不在词典里的用户内容'), '不在词典里的用户内容')
  applyLocale('zh', false)
})
