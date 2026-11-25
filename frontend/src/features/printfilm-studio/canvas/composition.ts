import { nodeMediaKind } from './nodeOperations.ts'
import { collectMediaUrls,clampMediaIndex } from './imageVariants.ts'
import type { Node,Edge } from '@xyflow/react'
import { tr } from '../../../i18n'
export type CompositionClip={id:string;label:string;url:string;ready:boolean;status:string}
export function compositionClips(id:string,nodes:Node<Record<string,unknown>>[],edges:Edge[]):CompositionClip[] {
  const target=nodes.find(node=>node.id===id),incoming=edges.filter(edge=>edge.target===id).map(edge=>edge.source)
  const saved=Array.isArray(target?.data.compositionOrder)?target.data.compositionOrder.map(String):[]
  return [...new Set([...saved.filter(value=>incoming.includes(value)),...incoming])].flatMap(value=>{
    const node=nodes.find(item=>item.id===value)
    if(!node || nodeMediaKind(node)!=='video')return []
    const urls=collectMediaUrls(node.data),url=urls[clampMediaIndex(node.data.mediaIndex,urls.length)]||'',status=String(node.data.status || '')
    return [{id:value,label:String(node.data.label || tr('studioCanvas.composition.clip')),url,ready:!!url&&!['queued','running','awaiting_composite','failed','cancelled'].includes(status),status}]
  })
}
export function compositionError(clips:CompositionClip[]) {
  if(clips.length<2)return tr('studioCanvas.composition.tooFew')
  if(clips.length>8)return tr('studioCanvas.composition.tooMany')
  const pending=clips.find(clip=>!clip.ready)
  return pending?(['queued','running','awaiting_composite'].includes(pending.status)?tr('studioCanvas.composition.stillGenerating',{label:pending.label}):tr('studioCanvas.composition.noVideo',{label:pending.label})):''
}
