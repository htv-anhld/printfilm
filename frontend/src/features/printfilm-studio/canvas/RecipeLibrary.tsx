import { useEffect, useRef, useState } from 'react'
import { Download, Layers, Plus, Trash2, Upload, X } from 'lucide-react'
import { printfilmStudioApi } from '../api'
import type { CanvasDocument } from './canvasCodec'
import type { Recipe } from './recipeGraph'
import { tr } from '../../../i18n'

export function RecipeLibrary({ projectId, draft, writable, onApply, onClose }: { projectId: number; draft?: CanvasDocument; writable: boolean; onApply: (recipe: Recipe) => void; onClose: () => void }) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [name, setName] = useState(() => tr('studioCanvas.recipeLibrary.defaultName'))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { let active = true; void printfilmStudioApi.listRecipes(projectId).then((value) => { if (active) setRecipes(value.recipes) }).catch((e) => { if (active) setError(e.message) }); return () => { active = false } }, [projectId])
  const save = async (document: CanvasDocument, title: string) => {
    setBusy(true); setError('')
    try { const recipe = await printfilmStudioApi.createRecipe(projectId, title, document); setRecipes((items) => [recipe, ...items]); setSaved(true) }
    catch (e) { setError(e instanceof Error ? e.message : tr('studioCanvas.recipeLibrary.saveFailed')) }
    finally { setBusy(false) }
  }
  const importFile = async (file?: File) => {
    if (!file) return
    try { if (file.size > 1_000_000) throw new Error(tr('studioCanvas.recipeLibrary.tooLarge')); const data = JSON.parse(await file.text()); if (data.printfilmRecipe !== 1) throw new Error(tr('studioCanvas.recipeLibrary.notRecipe')); await save(data.document, String(data.name || file.name).slice(0, 120)) }
    catch (e) { setError(e instanceof Error ? e.message : tr('studioCanvas.recipeLibrary.readFailed')) }
  }
  const download = (recipe: Recipe) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ printfilmRecipe: 1, name: recipe.name, document: recipe.document }, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `${recipe.name.replace(/[<>:"/\\|?*]/g, '_')}.printfilm.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="pf-workflow-backdrop" role="presentation" onClick={onClose}><section className="pf-workflow-dialog" role="dialog" aria-modal="true" aria-label={tr('studioCanvas.recipeLibrary.title')} onClick={(e) => e.stopPropagation()}>
    <header><h2><Layers size={20} />{tr('studioCanvas.recipeLibrary.title')}</h2><button onClick={onClose} aria-label={tr('studioCanvas.recipeLibrary.close')}><X size={20} /></button></header>
    <p>{tr('studioCanvas.recipeLibrary.desc')}</p>
    {draft && !saved && <form onSubmit={(e) => { e.preventDefault(); void save(draft, name) }}><input aria-label={tr('studioCanvas.recipeLibrary.name')} maxLength={120} required value={name} onChange={(e) => setName(e.target.value)} /><button disabled={busy || !name.trim()}><Plus size={16} />{tr('studioCanvas.recipeLibrary.saveNodes',{n:draft.nodes.length})}</button></form>}
    <button onClick={() => input.current?.click()} disabled={busy}><Upload size={16} />{tr('studioCanvas.recipeLibrary.import')}</button><input ref={input} hidden type="file" accept=".json" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = '' }} />
    {error && <p className="pf-workflow-error" role="alert">{error}</p>}
    <div className="pf-recipe-list">{recipes.length === 0 ? <p>{tr('studioCanvas.recipeLibrary.empty')}</p> : recipes.map((recipe) => <article key={recipe.id}><div><b>{recipe.name}</b><small>{tr('studioCanvas.recipeLibrary.stats',{nodes:recipe.document.nodes.length,edges:recipe.document.edges.length})}</small></div><button disabled={!writable || busy} onClick={() => onApply(recipe)}>{tr('studioCanvas.recipeLibrary.apply')}</button><button aria-label={tr('studioCanvas.recipeLibrary.export',{name:recipe.name})} onClick={() => download(recipe)}><Download size={16} /></button><button disabled={busy} aria-label={tr('studioCanvas.recipeLibrary.delete',{name:recipe.name})} onClick={async () => { setBusy(true); try { await printfilmStudioApi.deleteRecipe(recipe.id); setRecipes((items) => items.filter((item) => item.id !== recipe.id)) } catch (e) { setError(e instanceof Error ? e.message : tr('studioCanvas.recipeLibrary.deleteFailed')) } finally { setBusy(false) } }}><Trash2 size={16} /></button></article>)}</div>
  </section></div>
}
