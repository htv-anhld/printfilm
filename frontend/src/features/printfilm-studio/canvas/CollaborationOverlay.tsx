import { ViewportPortal, useViewport, type Node } from '@xyflow/react'
import { useSyncExternalStore } from 'react'
import type { PresenceStore } from '../collaboration'
import { absoluteNodePosition } from '../collaboration'
import { tr } from '../../../i18n'

const ACTIVITY_KEYS=['idle','selecting','dragging','editing','connecting','generating','saved'] as const
const activityLabel=(action:string)=>ACTIVITY_KEYS.includes(action as typeof ACTIVITY_KEYS[number])?tr(`studioCanvas.collaborationOverlay.activity.${action}`):action
export function CollaborationOverlay({store,nodes}:{store:PresenceStore;nodes:Node[]}) {
  const {peers,status}=useSyncExternalStore(store.subscribe,store.getSnapshot)
  const {zoom}=useViewport()
  return <>
    <div className="pf-collaborators" aria-label={tr('studioCanvas.collaborationOverlay.online')} role="status">
      {peers.map(peer=><span key={peer.session_id} className="pf-collaborator" title={`${peer.name} · ${activityLabel(peer.action)}`}><i style={{background:peer.color}}>{peer.name.slice(0,1)}</i><span>{peer.name}<small>{activityLabel(peer.action)}</small></span></span>)}
      {status==='offline'&&<small className="pf-collaboration-status">{tr('studioCanvas.collaborationOverlay.offline')}</small>}
      {status==='denied'&&<small className="pf-collaboration-status">{tr('studioCanvas.collaborationOverlay.denied')}</small>}
    </div>
    <ViewportPortal><div className="pf-awareness-layer" aria-hidden="true">
      {peers.map(peer=><div key={peer.session_id}>
        {peer.node_ids.map(id=>{
          const node=nodes.find(item=>item.id===id)
          if(!node)return null
          const pos=peer.positions.find(item=>item.id===id)||absoluteNodePosition(node,nodes)
          return <div key={id} className="pf-peer-selection" style={{left:pos.x,top:pos.y,width:node.measured?.width||node.width||320,height:node.measured?.height||node.height||200,borderColor:peer.color,borderWidth:2/zoom}}><span style={{background:peer.color,transform:`scale(${1/zoom})`}}>{peer.name} · {activityLabel(peer.action)}</span></div>
        })}
        {peer.cursor&&<div className="pf-peer-cursor" style={{left:peer.cursor.x,top:peer.cursor.y,color:peer.color,transform:`scale(${1/zoom})`}}><svg width="22" height="27" viewBox="0 0 22 27"><path d="M2 2L3 22L8 16L14 25L18 23L12 14L20 13Z" fill="currentColor" stroke="white" strokeWidth="1.5"/></svg><span style={{background:peer.color}}>{peer.name} · {activityLabel(peer.action)}</span></div>}
      </div>)}
    </div></ViewportPortal>
  </>
}
