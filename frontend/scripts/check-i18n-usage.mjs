// 扫描 src 中 t('…') / tr('…') 的字面 key，报告 zh 文案里不存在的 key（运行时会原样显示 key）
import { readdirSync, readFileSync, statSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const out = mkdtempSync(join(tmpdir(), 'pf-i18n-use-'))
function transpileDir(s, d) {
  mkdirSync(d, { recursive: true })
  for (const e of readdirSync(s, { withFileTypes: true })) {
    if (e.isDirectory()) { transpileDir(join(s, e.name), join(d, e.name)); continue }
    if (!e.name.endsWith('.ts')) continue
    const js = ts.transpileModule(readFileSync(join(s, e.name), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
      .outputText.replace(/from '(\.[^']+)'/g, "from '$1.mjs'")
    writeFileSync(join(d, e.name.replace(/\.ts$/, '.mjs')), js)
  }
}
function walk(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) { if (!p.includes('i18n')) walk(p, acc) } else if (/\.(ts|tsx)$/.test(n)) acc.push(p)
  }
  return acc
}
try {
  transpileDir(join(src, 'i18n', 'locales'), out)
  const zh = (await import(pathToFileURL(join(out, 'zh.mjs')).href)).zh
  const has = (path) => path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), zh) !== undefined
  const re = /\b(?:t|tr|translateIn\([^,]+,)\(\s*['"`]([a-zA-Z][\w]*(?:\.[\w]+)+)['"`]/g
  let missing = 0
  for (const f of walk(src)) {
    const text = readFileSync(f, 'utf8')
    for (const m of text.matchAll(re)) {
      if (!has(m[1])) { console.log(`${f.replace(src + '/', '')}: ${m[1]}`); missing++ }
    }
  }
  console.log(`\n${missing} missing key usage(s)`)
  process.exit(missing ? 1 : 0)
} finally { rmSync(out, { recursive: true, force: true }) }
