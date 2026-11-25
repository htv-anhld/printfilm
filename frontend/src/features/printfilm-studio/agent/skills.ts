import { tr } from '../../../i18n'
import type { AgentSkill } from '../../../api/agentSkills'

export const STUDIO_SKILL_TASKS = ['script_write', 'asset_plan', 'shot_plan', 'video_prompt', 'edit_plan'] as const
export type StudioSkillTask = typeof STUDIO_SKILL_TASKS[number]
export type StudioSkillSelection = Record<StudioSkillTask, number | null>

const PREFERRED_SLUGS: Record<StudioSkillTask, string> = {
  script_write: 'printfilm-script-director',
  edit_plan: 'printfilm-edit-director',
  asset_plan: 'short-drama-assets',
  shot_plan: 'short-drama-storyboard',
  video_prompt: 'short-drama-video-prompts',
}

/** 未加载或缺少推荐 Skill 时保持关闭，避免无意注入全部规则。 */
export function emptyStudioSkillSelection(): StudioSkillSelection {
  return { script_write: null, asset_plan: null, shot_plan: null, video_prompt: null, edit_plan: null }
}

/** 五个阶段各选一个通用默认值；Seedance 专用 Skill 由用户显式选择。 */
export function defaultStudioSkillSelection(skills: AgentSkill[]): StudioSkillSelection {
  const selection = emptyStudioSkillSelection()
  for (const task of STUDIO_SKILL_TASKS) {
    selection[task] = skills.find((skill) => skill.is_active && skill.slug === PREFERRED_SLUGS[task])?.id ?? null
  }
  return selection
}

/** 当前阶段可选项只包含启用的匹配 Skill 或通用 Skill。 */
export function studioSkillsForTask(skills: AgentSkill[], task: StudioSkillTask): AgentSkill[] {
  return skills.filter((skill) => skill.is_active && (skill.tasks.includes(task) || skill.tasks.includes('all')))
}

/** 每次请求最多携带一个阶段 Skill；通用助手不注入导演规则。 */
export function studioSkillOptions(selection: StudioSkillSelection, task: StudioSkillTask, mode: 'director' | 'assistant'): { agent_mode: 'director' | 'assistant'; skill_task: StudioSkillTask; skill_ids: number[] } {
  const id = selection[task]
  return {
    agent_mode: mode,
    skill_task: task,
    skill_ids: mode === 'director' && id !== null ? [id] : [],
  }
}


/* 阶段名 / 技能名在读取时取当前语言文案（getter）。 */
export const STUDIO_SKILL_LABELS: Record<StudioSkillTask,string> = {get script_write(){return tr('studioCanvas.skills.taskScriptWrite')},get asset_plan(){return tr('studioCanvas.skills.taskAssetPlan')},get shot_plan(){return tr('studioCanvas.skills.taskShotPlan')},get video_prompt(){return tr('studioCanvas.skills.taskVideoPrompt')},get edit_plan(){return tr('studioCanvas.skills.taskEditPlan')}}
export const STUDIO_SKILL_NAMES: Record<string,string> = {get 'short-drama-assets'(){return tr('studioCanvas.skills.skillAssets')},get 'short-drama-storyboard'(){return tr('studioCanvas.skills.skillStoryboard')},get 'short-drama-video-prompts'(){return tr('studioCanvas.skills.skillVideoPrompts')},get 'seedance-2-5-video-director'(){return tr('studioCanvas.skills.skillSeedance')},get 'cinedance-seedance'(){return tr('studioCanvas.skills.skillCinedance')}}
export const studioSkillName = (skill: AgentSkill) => STUDIO_SKILL_NAMES[skill.slug] || skill.name

export function restoreStudioSkillSelection(skills: AgentSkill[], stored: unknown): StudioSkillSelection {
  const selection = defaultStudioSkillSelection(skills)
  if (!stored || typeof stored !== 'object') return selection
  for (const task of STUDIO_SKILL_TASKS) {
    const id = (stored as Record<string,unknown>)[task]
    if (id === null) selection[task] = null
    else if (typeof id === 'number' && studioSkillsForTask(skills,task).some(skill=>skill.id===id)) selection[task] = id
  }
  return selection
}

export function inferredStudioSkillTask(prompt: string, fallback: StudioSkillTask): StudioSkillTask {
  // 同时识别越南语 / 英语请求，界面文案本地化后仍能推断阶段
  if (/剪辑|合成|剪片|转场/.test(prompt) || /dựng phim|ghép video|chuyển cảnh|\bedit(ing)?\b|transitions?/i.test(prompt)) return 'edit_plan'
  if (/拆.*分镜|拆.*镜头|分镜规划|规划.*分镜|按场拆/.test(prompt) || /(tách|lập|chia).*(phân cảnh|cảnh quay)|(split|plan).*shots?|shot list/i.test(prompt)) return 'shot_plan'
  if (/抽取.*角色|提取.*角色|角色.*场景|场景.*抽取/.test(prompt) || /trích xuất.*nhân vật|nhân vật.*bối cảnh|extract.*characters?|characters?.*scenes?/i.test(prompt)) return 'asset_plan'
  if (/提示词|运镜优化/.test(prompt)) return 'video_prompt'
  if (/写.*剧本|生成.*剧本|创作.*剧本|改编.*剧本/.test(prompt) || /(viết|tạo|sáng tác|chuyển thể).*kịch bản|(write|create|adapt).*(script|screenplay)/i.test(prompt)) return 'script_write'
  return fallback
}
