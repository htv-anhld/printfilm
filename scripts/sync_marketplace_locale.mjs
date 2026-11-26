// 后端维护的系统提示同步给前端，以便切换语言时重绘已经收到的提示。
// 越南语：后端 locale_messages_vi.json 是服务端提示的来源，合并进前端 locale-vi.json（前端额外的界面文案保留）。
import { readFileSync, writeFileSync } from 'node:fs'
const source = new URL('../backend/app/marketplace/locale_messages.json', import.meta.url)
const target = new URL('../frontend/src/features/marketplace/locale-server.json', import.meta.url)
writeFileSync(target, JSON.stringify(JSON.parse(readFileSync(source, 'utf8')), null, 2) + '\n')
const viSource = new URL('../backend/app/marketplace/locale_messages_vi.json', import.meta.url)
const viTarget = new URL('../frontend/src/features/marketplace/locale-vi.json', import.meta.url)
const merged = { ...JSON.parse(readFileSync(viTarget, 'utf8')), ...JSON.parse(readFileSync(viSource, 'utf8')) }
writeFileSync(viTarget, JSON.stringify(merged, null, 2) + '\n')
