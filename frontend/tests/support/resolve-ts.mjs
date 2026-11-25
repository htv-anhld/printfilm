// 测试专用解析钩子：让 node --experimental-strip-types 能加载源码里无扩展名 / 目录形式的相对导入（如 '../i18n'）
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const base = fileURLToPath(new URL(specifier, context.parentURL))
    const isDir = existsSync(base) && statSync(base).isDirectory()
    // 源码 i18n 入口会导出 React context（.tsx），测试改用不含 context 的入口
    if (isDir && base.replace(/\\/g, '/').endsWith('/src/i18n')) {
      return next(new URL('./i18n-node.ts', import.meta.url).href, context)
    }
    if (!existsSync(base) || isDir) {
      for (const cand of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        if (existsSync(base + cand)) return next(new URL(specifier + cand, context.parentURL).href, context)
      }
    }
  }
  return next(specifier, context)
}
