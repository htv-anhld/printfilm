import { tr } from '../../../i18n'
import type { AgentSkill } from '../../../api/agentSkills'
import { STUDIO_SKILL_TASKS, STUDIO_SKILL_LABELS, studioSkillName, studioSkillsForTask, type StudioSkillTask, type StudioSkillSelection } from './skills'

export function DirectorSkillPicker({skills,selection,task,disabled,onTask,onSelect}: {skills:AgentSkill[];selection:StudioSkillSelection;task:StudioSkillTask;disabled:boolean;onTask:(task:StudioSkillTask)=>void;onSelect:(task:StudioSkillTask,id:number|null)=>void}) {
  const selected=skills.find(skill=>skill.id===selection[task])
  return <details className="pf-director-skills">
    <summary aria-label={tr('studioCanvas.directorSkillPicker.pick')}>{tr('studioCanvas.directorSkillPicker.summary', { task: STUDIO_SKILL_LABELS[task], skill: selected ? studioSkillName(selected) : tr('studioCanvas.directorSkillPicker.none') })}</summary>
    <div className="pf-director-phases" aria-label={tr('studioCanvas.directorSkillPicker.phases')}>{STUDIO_SKILL_TASKS.map(phase=><button key={phase} type="button" disabled={disabled} aria-pressed={phase===task} onClick={()=>onTask(phase)}>{STUDIO_SKILL_LABELS[phase]}</button>)}</div>
    <div className="pf-director-options" role="radiogroup" aria-label={tr('studioCanvas.directorSkillPicker.taskSkills', { task: STUDIO_SKILL_LABELS[task] })} onKeyDown={event=>{
      if (disabled || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return
      event.preventDefault(); event.stopPropagation()
      const choices=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
      const at=choices.indexOf(event.target as HTMLButtonElement)
      const next=event.key==='Home' ? 0 : event.key==='End' ? choices.length-1 : (at+(['ArrowRight','ArrowDown'].includes(event.key)?1:-1)+choices.length)%choices.length
      choices[next]?.focus(); choices[next]?.click()
    }}>
      <button type="button" role="radio" tabIndex={selection[task]===null?0:-1} aria-checked={selection[task]===null} disabled={disabled} onClick={()=>onSelect(task,null)}><b>{tr('studioCanvas.directorSkillPicker.none')}</b><small>{tr('studioCanvas.directorSkillPicker.noneHint')}</small></button>
      {studioSkillsForTask(skills,task).map(skill=><button key={skill.id} type="button" role="radio" tabIndex={selection[task]===skill.id?0:-1} aria-checked={selection[task]===skill.id} disabled={disabled} onClick={()=>onSelect(task,skill.id)}><b>{studioSkillName(skill)}</b><small>{skill.description}</small></button>)}
    </div>
    {selected && <details className="pf-director-rules"><summary>{tr('studioCanvas.directorSkillPicker.rules')}</summary><pre>{selected.body}</pre></details>}
    <p>{tr('studioCanvas.directorSkillPicker.hint')}</p>
  </details>
}
