import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MediaSnapshot } from './mediaHistory'
import { tr } from '../../../i18n'

export function MediaVariants({items,index,video,writable,onSelect,onCompare,onSplit}:{items:MediaSnapshot[];index:number;video:boolean;writable:boolean;onSelect:(index:number)=>void;onCompare:()=>void;onSplit:()=>void}) {
  if(items.length<2)return null
  return <><div className="pf-variant-controls nodrag nopan" onClick={event=>event.stopPropagation()}><button aria-label={tr('studioCanvas.mediaVariants.prev')} disabled={!writable||index<=0} onClick={()=>onSelect(index-1)}><ChevronLeft size={15}/></button><span>{index+1} / {items.length}</span><button aria-label={tr('studioCanvas.mediaVariants.next')} disabled={!writable||index>=items.length-1} onClick={()=>onSelect(index+1)}><ChevronRight size={15}/></button><button onClick={onCompare}>{tr('studioCanvas.mediaVariants.compare')}</button><button disabled={!writable} onClick={onSplit}>{tr('studioCanvas.mediaVariants.split')}</button></div><div className="pf-variant-thumbs nodrag nopan nowheel" onClick={event=>event.stopPropagation()}>{items.map((item,i)=><button type="button" key={item.mediaUrl} aria-label={tr('studioCanvas.mediaVariants.use',{n:i+1})} aria-pressed={i===index} disabled={!writable} onClick={()=>onSelect(i)}>{video?<video src={item.mediaUrl} muted preload="metadata"/>:<img src={item.mediaUrl} alt={tr('studioCanvas.mediaVariants.version',{n:i+1})}/>}</button>)}</div></>
}
