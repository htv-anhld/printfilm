/**
 * 剧本 / 分镜结构标记的显示本地化。
 *
 * 后端解析器与 Seedance 提示词依赖中文标记（【画面·…】【字幕：…】「夜 内」「出场人物：」等），
 * 存储一律保持中文；越南语 / 英语项目只在界面上显示成对应语言，保存前再还原成中文标记。
 * 映射是一一对应的固定短语，localize → delocalize 可无损往返。
 */

type Lang = 'vi' | 'en'

/** 整句 cue（先于前缀替换，按长度降序匹配） */
const FULL_CUES: Record<Lang, Array<[string, string]>> = {
  vi: [
    ['【字幕：底部居中·简体中文·逐句轮换·与口播同步】', '【Phụ đề: giữa dưới · ngôn ngữ dự án · từng câu · khớp lời thoại】'],
    ['【字幕：底部居中·简体中文·仅标记段落同步】', '【Phụ đề: giữa dưới · ngôn ngữ dự án · chỉ đoạn được đánh dấu】'],
    ['【字幕：全程简体中文字幕，旁白逐句同步烧录】', '【Phụ đề: toàn bộ · ngôn ngữ dự án · khớp từng câu lời dẫn】'],
    ['【字幕：底部居中·简体中文】', '【Phụ đề: giữa dưới · ngôn ngữ dự án】'],
    ['【画面·无配音仅环境音】', '【Hình ảnh · không lời, chỉ âm thanh môi trường】'],
    ['【空镜·可仅环境音与 BGM】', '【Cảnh trống · chỉ âm thanh môi trường và nhạc nền】'],
    ['【人物介绍·画面叠字·角色身旁】', '【Giới thiệu nhân vật · chữ trên hình · cạnh nhân vật】'],
    ['【人物介绍·画面叠字】', '【Giới thiệu nhân vật · chữ trên hình】'],
    ['【背景介绍·画面叠字】', '【Giới thiệu bối cảnh · chữ trên hình】'],
    ['【片头·剧名叠字】', '【Mở đầu · chữ tên phim】'],
    ['【片头·类型标注】', '【Mở đầu · nhãn thể loại】'],
    ['【片头·集号叠字】', '【Mở đầu · chữ số tập】'],
    ['【片头·集名叠字】', '【Mở đầu · chữ tên tập】'],
    ['【对白·慢速清晰·同步字幕】', '【Thoại · chậm rõ · phụ đề đồng bộ】'],
    ['【对白·慢速清晰】', '【Thoại · chậm rõ】'],
    ['【旁白·慢速清晰·同步字幕】', '【Lời dẫn · chậm rõ · phụ đề đồng bộ】'],
    ['【旁白·慢速清晰】', '【Lời dẫn · chậm rõ】'],
    ['【旁白·自然语速·同步字幕】', '【Lời dẫn · tốc độ tự nhiên · phụ đề đồng bộ】'],
    ['【旁白·自然语速】', '【Lời dẫn · tốc độ tự nhiên】'],
    ['【内心独白·同步字幕】', '【Độc thoại nội tâm · phụ đề đồng bộ】'],
  ],
  en: [
    ['【字幕：底部居中·简体中文·逐句轮换·与口播同步】', '【Subtitles: bottom center · project language · line by line · synced to speech】'],
    ['【字幕：底部居中·简体中文·仅标记段落同步】', '【Subtitles: bottom center · project language · marked segments only】'],
    ['【字幕：全程简体中文字幕，旁白逐句同步烧录】', '【Subtitles: throughout · project language · synced to narration】'],
    ['【字幕：底部居中·简体中文】', '【Subtitles: bottom center · project language】'],
    ['【画面·无配音仅环境音】', '【Visual · no voice, ambient sound only】'],
    ['【空镜·可仅环境音与 BGM】', '【Empty shot · ambient sound and music only】'],
    ['【人物介绍·画面叠字·角色身旁】', '【Character intro · on-screen text · beside the character】'],
    ['【人物介绍·画面叠字】', '【Character intro · on-screen text】'],
    ['【背景介绍·画面叠字】', '【Background · on-screen text】'],
    ['【片头·剧名叠字】', '【Opening · series title text】'],
    ['【片头·类型标注】', '【Opening · genre tag】'],
    ['【片头·集号叠字】', '【Opening · episode number text】'],
    ['【片头·集名叠字】', '【Opening · episode title text】'],
    ['【对白·慢速清晰·同步字幕】', '【Dialogue · slow and clear · synced subtitles】'],
    ['【对白·慢速清晰】', '【Dialogue · slow and clear】'],
    ['【旁白·慢速清晰·同步字幕】', '【Narration · slow and clear · synced subtitles】'],
    ['【旁白·慢速清晰】', '【Narration · slow and clear】'],
    ['【旁白·自然语速·同步字幕】', '【Narration · natural pace · synced subtitles】'],
    ['【旁白·自然语速】', '【Narration · natural pace】'],
    ['【内心独白·同步字幕】', '【Inner monologue · synced subtitles】'],
  ],
}

/** 方括号前缀（后面的内容由 AI 按内容语言书写，原样保留） */
const PREFIXES: Record<Lang, Array<[string, string]>> = {
  vi: [
    ['【旁白·', '【Lời dẫn · '],
    ['【对白·', '【Thoại · '],
    ['【内心独白·', '【Độc thoại nội tâm · '],
    ['【人物介绍·', '【Giới thiệu nhân vật · '],
    ['【背景介绍·', '【Giới thiệu bối cảnh · '],
    ['【片头·', '【Mở đầu · '],
    ['【画面·', '【Hình ảnh · '],
    ['【空镜·', '【Cảnh trống · '],
    ['【空镜：', '【Cảnh trống: '],
    ['【BGM：', '【Nhạc nền: '],
    ['【配乐：', '【Phối nhạc: '],
    ['【字幕：', '【Phụ đề: '],
    ['【强制约束：', '【Ràng buộc bắt buộc: '],
    ['【强制任务：', '【Nhiệm vụ bắt buộc: '],
    ['·慢速清晰', ' · chậm rõ'],
    ['·自然语速', ' · tốc độ tự nhiên'],
    ['·同步字幕', ' · phụ đề đồng bộ'],
    ['·画面叠字', ' · chữ trên hình'],
  ],
  en: [
    ['【旁白·', '【Narration · '],
    ['【对白·', '【Dialogue · '],
    ['【内心独白·', '【Inner monologue · '],
    ['【人物介绍·', '【Character intro · '],
    ['【背景介绍·', '【Background · '],
    ['【片头·', '【Opening · '],
    ['【画面·', '【Visual · '],
    ['【空镜·', '【Empty shot · '],
    ['【空镜：', '【Empty shot: '],
    ['【BGM：', '【Music: '],
    ['【配乐：', '【Score: '],
    ['【字幕：', '【Subtitles: '],
    ['【强制约束：', '【Required constraint: '],
    ['【强制任务：', '【Required task: '],
    ['·慢速清晰', ' · slow and clear'],
    ['·自然语速', ' · natural pace'],
    ['·同步字幕', ' · synced subtitles'],
    ['·画面叠字', ' · on-screen text'],
  ],
}

/** 行首标签（出场人物、旁白、景别） */
const LINE_LABELS: Record<Lang, Array<[string, string]>> = {
  vi: [
    ['出场人物：', 'Nhân vật xuất hiện: '],
    ['旁白（VO）：', 'Lời dẫn (VO): '],
    ['空镜：', 'Cảnh trống: '],
    ['远景：', 'Viễn cảnh: '],
    ['全景：', 'Toàn cảnh: '],
    ['中景：', 'Trung cảnh: '],
    ['近景：', 'Cận cảnh: '],
    ['特写：', 'Đặc tả: '],
  ],
  en: [
    ['出场人物：', 'Cast: '],
    ['旁白（VO）：', 'Narration (VO): '],
    ['空镜：', 'Empty shot: '],
    ['远景：', 'Long shot: '],
    ['全景：', 'Full shot: '],
    ['中景：', 'Medium shot: '],
    ['近景：', 'Close shot: '],
    ['特写：', 'Close-up: '],
  ],
}

/** 场头「夜 内」：时间 + 内/外 */
const TIMES: Record<Lang, Array<[string, string]>> = {
  vi: [
    ['黄昏', 'HOÀNG HÔN'],
    ['日', 'NGÀY'],
    ['夜', 'ĐÊM'],
    ['晨', 'SÁNG SỚM'],
    ['昏', 'CHIỀU TỐI'],
  ],
  en: [
    ['黄昏', 'DUSK'],
    ['日', 'DAY'],
    ['夜', 'NIGHT'],
    ['晨', 'DAWN'],
    ['昏', 'EVENING'],
  ],
}
const PLACES: Record<Lang, Array<[string, string]>> = {
  vi: [
    ['内', 'NỘI'],
    ['外', 'NGOẠI'],
  ],
  en: [
    ['内', 'INT'],
    ['外', 'EXT'],
  ],
}

function asLang(locale: string | null | undefined): Lang | null {
  return locale === 'vi' || locale === 'en' ? locale : null
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 按「源短语长度降序」做一次性多模式替换，避免短语互相覆盖
function replaceAll(text: string, pairs: Array<[string, string]>, reverse: boolean): string {
  const entries = pairs.map(([zh, loc]) => (reverse ? [loc, zh] : [zh, loc]) as [string, string])
  entries.sort((a, b) => b[0].length - a[0].length)
  const map = new Map(entries)
  const re = new RegExp(entries.map(([from]) => escapeRe(from)).join('|'), 'g')
  return text.replace(re, (m) => map.get(m) ?? m)
}

// 行首标签：允许前面有空白、「△」或若干【…】cue
function replaceLineLabels(text: string, pairs: Array<[string, string]>, reverse: boolean): string {
  const entries = pairs.map(([zh, loc]) => (reverse ? [loc, zh] : [zh, loc]) as [string, string])
  entries.sort((a, b) => b[0].length - a[0].length)
  const map = new Map(entries)
  // 行首可先有若干【…】cue（如「【画面·…】空镜：…」）
  const re = new RegExp(
    `^([ \\t]*(?:△\\s*)?(?:【[^】\\n]*】\\s*)*(?:△\\s*)?)(${entries.map(([f]) => escapeRe(f)).join('|')})`,
    'gm',
  )
  return text.replace(re, (_m, lead: string, label: string) => `${lead}${map.get(label) ?? label}`)
}

// 场头：「夜 内 …」↔「ĐÊM · NỘI …」
function replaceSceneHeads(text: string, lang: Lang, reverse: boolean): string {
  const times = TIMES[lang]
  const places = PLACES[lang]
  if (!reverse) {
    const t = times.map(([zh]) => escapeRe(zh)).join('|')
    const p = places.map(([zh]) => escapeRe(zh)).join('|')
    const re = new RegExp(`^([ \\t]*)(${t})\\s*(${p})(?=\\s|$)`, 'gm')
    return text.replace(re, (_m, lead: string, time: string, place: string) => {
      const tl = times.find(([zh]) => zh === time)?.[1] ?? time
      const pl = places.find(([zh]) => zh === place)?.[1] ?? place
      return `${lead}${tl} · ${pl}`
    })
  }
  const t = [...times].sort((a, b) => b[1].length - a[1].length).map(([, loc]) => escapeRe(loc)).join('|')
  const p = places.map(([, loc]) => escapeRe(loc)).join('|')
  const re = new RegExp(`^([ \\t]*)(${t}) · (${p})(?=\\s|$)`, 'gm')
  return text.replace(re, (_m, lead: string, time: string, place: string) => {
    const tz = times.find(([, loc]) => loc === time)?.[0] ?? time
    const pz = places.find(([, loc]) => loc === place)?.[0] ?? place
    return `${lead}${tz} ${pz}`
  })
}

// 场号「### 场1-2」↔「### Cảnh 1-2 / ### Scene 1-2」
function replaceSceneNumbers(text: string, lang: Lang, reverse: boolean): string {
  const word = lang === 'vi' ? 'Cảnh' : 'Scene'
  if (!reverse) return text.replace(/^(###\s*)场(?:景)?\s*(\d+\s*[-－—]\s*\d+)/gm, `$1${word} $2`)
  return text.replace(new RegExp(`^(###\\s*)${word} (\\d+\\s*[-－—]\\s*\\d+)`, 'gm'), '$1场$2')
}

/** 中文结构标记 → 界面语言（zh 或未知语言原样返回） */
export function localizeDramaMarkers(text: string, locale: string | null | undefined): string {
  const lang = asLang(locale)
  if (!lang || !text) return text
  let out = replaceAll(text, FULL_CUES[lang], false)
  out = replaceAll(out, PREFIXES[lang], false)
  out = replaceLineLabels(out, LINE_LABELS[lang], false)
  out = replaceSceneHeads(out, lang, false)
  return replaceSceneNumbers(out, lang, false)
}

/** 界面语言标记 → 中文结构标记（保存 / 提交前调用） */
export function delocalizeDramaMarkers(text: string, locale: string | null | undefined): string {
  const lang = asLang(locale)
  if (!lang || !text) return text
  let out = replaceSceneNumbers(text, lang, true)
  out = replaceSceneHeads(out, lang, true)
  out = replaceLineLabels(out, LINE_LABELS[lang], true)
  out = replaceAll(out, FULL_CUES[lang], true)
  return replaceAll(out, PREFIXES[lang], true)
}
