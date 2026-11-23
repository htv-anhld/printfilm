// 校验 src/i18n/locales 下 zh / en / vi 的 key 结构完全一致，并报告 en/vi 中残留的中文
// 用法：node scripts/check-i18n.mjs [命名空间...]   例：node scripts/check-i18n.mjs studio
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales')
const out = mkdtempSync(join(tmpdir(), 'pf-i18n-'))

// 把 locales/**/*.ts 转成 .mjs，import 路径补扩展名
function transpileDir(src, dst) {
  mkdirSync(dst, { recursive: true })
  for (const ent of readdirSync(src, { withFileTypes: true })) {
    if (ent.isDirectory()) { transpileDir(join(src, ent.name), join(dst, ent.name)); continue }
    if (!ent.name.endsWith('.ts')) continue
    const js = ts.transpileModule(readFileSync(join(src, ent.name), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText.replace(/from '(\.[^']+)'/g, "from '$1.mjs'")
    writeFileSync(join(dst, ent.name.replace(/\.ts$/, '.mjs')), js)
  }
}

// 展平为 path → value
function flatten(obj, prefix = '', acc = new Map()) {
  if (Array.isArray(obj)) {
    acc.set(prefix, `[array:${obj.length}]`)
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, acc))
  } else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) flatten(v, prefix ? `${prefix}.${k}` : k, acc)
  } else acc.set(prefix, obj)
  return acc
}

try {
  transpileDir(root, out)
  const load = async (l) => (await import(pathToFileURL(join(out, `${l}.mjs`)).href))[l]
  const [zh, en, vi] = await Promise.all(['zh', 'en', 'vi'].map(load))
  const only = process.argv.slice(2)
  const inScope = (p) => !only.length || only.some((ns) => p === ns || p.startsWith(`${ns}.`))
  const fz = flatten(zh), fe = flatten(en), fv = flatten(vi)
  const cjk = /[一-鿿]/
  let errors = 0, warns = 0
  for (const [name, f] of [['en', fe], ['vi', fv]]) {
    for (const k of fz.keys()) if (inScope(k) && !f.has(k)) { console.log(`MISSING ${name}: ${k}`); errors++ }
    for (const k of f.keys()) if (inScope(k) && !fz.has(k)) { console.log(`EXTRA   ${name}: ${k}`); errors++ }
    for (const [k, v] of f) {
      if (!inScope(k) || typeof v !== 'string') continue
      if (cjk.test(v)) { console.log(`CJK     ${name}: ${k} = ${v.slice(0, 60)}`); warns++ }
      const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
      if (fz.has(k) && vars(fz.get(k)) !== vars(v)) { console.log(`VARS    ${name}: ${k} zh{${vars(fz.get(k))}} vs {${vars(v)}}`); errors++ }
    }
  }
  console.log(`\n${errors} error(s), ${warns} CJK warning(s)${only.length ? ` in [${only.join(', ')}]` : ''}`)
  process.exit(errors ? 1 : 0)
} finally {
  rmSync(out, { recursive: true, force: true })
}
