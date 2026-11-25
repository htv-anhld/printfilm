// 注册测试解析钩子（见 resolve-ts.mjs）
import { register } from 'node:module'

register('./resolve-ts.mjs', import.meta.url)

// 上游测试按中文默认语言编写；应用默认越南语，测试进程里先切到 zh（各测试仍可自行 applyLocale）
const { applyLocale } = await import('../../src/i18n/detect.ts')
applyLocale('zh', false)
globalThis.__PF_TEST_LOCALE__ = 'zh'
