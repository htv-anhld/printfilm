import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { api, API_BASE } from '../api'
import AppShell from '../components/layout/AppShell'
import { useI18n } from '../i18n'
import {
  EMPTY_SCENE,
  buildObject,
  lensToFov,
  newObject,
  normalizeScene,
  ratioValue,
  readTransform,
  type ObjectType,
  type SceneData,
  type SceneObject,
} from '../lib/studio3dScene'

const OBJECT_TYPES: ObjectType[] = ['person', 'person_sit', 'box', 'table', 'chair', 'wall', 'door', 'car', 'tree', 'light']
const LENSES = [14, 18, 24, 35, 50, 85, 135]
const RATIOS = ['16:9', '9:16', '1:1', '4:3', '2.39:1']

type SceneSummary = { id: number; name: string; snapshot_url?: string | null }

/** 3D 布局工作室：摆放人物 / 道具与机位，截图作为生图 / 生视频的构图参考 */
export default function Studio3DPage() {
  const { t } = useI18n()
  /* 场景列表与当前场景 */
  const [scenes, setScenes] = useState<SceneSummary[]>([])
  const [sceneId, setSceneId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [data, setData] = useState<SceneData>(EMPTY_SCENE)
  /* 编辑状态 */
  const [selected, setSelected] = useState<string | null>(null)
  const [mode, setMode] = useState<'translate' | 'rotate' | 'scale'>('translate')
  const [shotView, setShotView] = useState(false)
  const [snapshot, setSnapshot] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /* three.js 运行时对象（不进 React 状态） */
  const mountRef = useRef<HTMLDivElement>(null)
  const rt = useRef<{
    renderer: THREE.WebGLRenderer
    scene: THREE.Scene
    editorCam: THREE.PerspectiveCamera
    shotCam: THREE.PerspectiveCamera
    camHelper: THREE.CameraHelper
    orbit: OrbitControls
    transform: TransformControls
    nodes: Map<string, THREE.Group>
    helpers: THREE.Object3D[]
  } | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data
  const shotViewRef = useRef(shotView)
  shotViewRef.current = shotView

  const loggedIn = Boolean(localStorage.getItem('token'))

  // 初始化渲染器 / 灯光 / 地面 / 控制器（只执行一次）
  useEffect(() => {
    const mount = mountRef.current
    if (!mount || !loggedIn) return
    // 浏览器禁用 / 不支持 WebGL 时 three 会抛错；捕获后给出提示，避免整页白屏
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    } catch {
      setError(t('studio3d.webglUnavailable'))
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    mount.appendChild(renderer.domElement)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#dfe3e8')
    scene.add(new THREE.HemisphereLight('#ffffff', '#8899aa', 1.2))
    const sun = new THREE.DirectionalLight('#ffffff', 1.6)
    sun.position.set(5, 8, 4)
    sun.castShadow = true
    scene.add(sun)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: '#c9ced4', roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)
    const grid = new THREE.GridHelper(40, 40, '#8a939c', '#aab2ba')
    scene.add(grid)
    const editorCam = new THREE.PerspectiveCamera(50, 1, 0.05, 200)
    editorCam.position.set(6, 5, 9)
    const shotCam = new THREE.PerspectiveCamera(lensToFov(35), 16 / 9, 0.05, 200)
    const camHelper = new THREE.CameraHelper(shotCam)
    scene.add(camHelper)
    const orbit = new OrbitControls(editorCam, renderer.domElement)
    orbit.target.set(0, 1, 0)
    orbit.update()
    const transform = new TransformControls(editorCam, renderer.domElement)
    transform.addEventListener('dragging-changed', (e) => {
      orbit.enabled = !(e as unknown as { value: boolean }).value
    })
    transform.addEventListener('objectChange', () => {
      const node = transform.object
      const id = node?.userData.id as string | undefined
      if (!node || !id) return
      setData((prev) => ({ ...prev, objects: prev.objects.map((o) => (o.id === id ? readTransform(o, node) : o)) }))
    })
    const tHelper = transform.getHelper()
    scene.add(tHelper)
    rt.current = { renderer, scene, editorCam, shotCam, camHelper, orbit, transform, nodes: new Map(), helpers: [grid, camHelper, tHelper] }

    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      renderer.setSize(w, h)
      editorCam.aspect = w / h
      editorCam.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    // 点击选择对象
    const ray = new THREE.Raycaster()
    const onClick = (ev: MouseEvent) => {
      if (shotViewRef.current) return
      const rect = renderer.domElement.getBoundingClientRect()
      const p = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1)
      ray.setFromCamera(p, editorCam)
      const hits = ray.intersectObjects([...rt.current!.nodes.values()], true)
      let node: THREE.Object3D | null = hits[0]?.object ?? null
      while (node && !node.userData.id) node = node.parent
      setSelected((node?.userData.id as string) ?? null)
    }
    renderer.domElement.addEventListener('pointerdown', onClick)

    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const r = rt.current!
      if (shotViewRef.current) {
        const w = mount.clientWidth
        const h = mount.clientHeight
        const aspect = ratioValue(dataRef.current.ratio)
        // 机位视图：按画幅留黑边
        const vw = Math.min(w, h * aspect)
        const vh = vw / aspect
        renderer.setScissorTest(true)
        renderer.setClearColor('#111')
        renderer.setViewport(0, 0, w, h)
        renderer.setScissor(0, 0, w, h)
        renderer.clear()
        renderer.setViewport((w - vw) / 2, (h - vh) / 2, vw, vh)
        renderer.setScissor((w - vw) / 2, (h - vh) / 2, vw, vh)
        r.helpers.forEach((x) => (x.visible = false))
        renderer.render(scene, r.shotCam)
        r.helpers.forEach((x) => (x.visible = true))
        renderer.setScissorTest(false)
      } else {
        renderer.setViewport(0, 0, mount.clientWidth, mount.clientHeight)
        renderer.render(scene, editorCam)
      }
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      renderer.domElement.removeEventListener('pointerdown', onClick)
      transform.dispose()
      orbit.dispose()
      renderer.dispose()
      mount.removeChild(renderer.domElement)
      rt.current = null
    }
  }, [loggedIn])

  // 场景对象变化 → 同步 three 节点（增删 + 颜色 / 变换）
  useEffect(() => {
    const r = rt.current
    if (!r) return
    const ids = new Set(data.objects.map((o) => o.id))
    for (const [id, node] of r.nodes) {
      if (!ids.has(id)) {
        if (r.transform.object === node) r.transform.detach()
        r.scene.remove(node)
        r.nodes.delete(id)
      }
    }
    for (const obj of data.objects) {
      const existing = r.nodes.get(obj.id)
      const stale = existing && (existing.userData.color !== obj.color || existing.userData.type !== obj.type)
      if (!existing || stale) {
        if (existing) r.scene.remove(existing)
        const node = buildObject(obj)
        node.userData.color = obj.color
        node.userData.type = obj.type
        r.scene.add(node)
        r.nodes.set(obj.id, node)
      } else if (r.transform.object !== existing || !r.transform.dragging) {
        existing.position.set(...obj.position)
        existing.rotation.y = obj.rotationY
        existing.scale.setScalar(obj.scale)
      }
    }
    // 机位
    r.shotCam.position.set(...data.camera.position)
    r.shotCam.lookAt(new THREE.Vector3(...data.camera.target))
    r.shotCam.fov = lensToFov(data.camera.lens)
    r.shotCam.aspect = ratioValue(data.ratio)
    r.shotCam.updateProjectionMatrix()
    r.camHelper.update()
  }, [data])

  // 选中对象 → 挂变换手柄
  useEffect(() => {
    const r = rt.current
    if (!r) return
    const node = selected ? r.nodes.get(selected) : undefined
    if (node) r.transform.attach(node)
    else r.transform.detach()
    r.transform.setMode(mode)
    r.transform.showY = mode !== 'translate'
  }, [selected, mode, data.objects.length])

  const loadList = useCallback(async () => {
    const res = await api.studio3dScenes()
    setScenes(res.items)
  }, [])

  useEffect(() => {
    if (loggedIn) loadList().catch(() => undefined)
  }, [loadList, loggedIn])

  if (!loggedIn) return <Navigate to="/auth?next=%2Fstudio3d" replace />

  async function open(id: number) {
    const s = await api.studio3dScene(id)
    setSceneId(s.id)
    setName(s.name)
    setData(normalizeScene(s.data))
    setSnapshot(s.snapshot_url || '')
    setSelected(null)
  }

  function addObject(type: ObjectType) {
    const obj = newObject(type, data.objects.length, t(`studio3d.objects.${type}`))
    setData((prev) => ({ ...prev, objects: [...prev.objects, obj] }))
    setSelected(obj.id)
  }

  function patchSelected(patch: Partial<SceneObject>) {
    setData((prev) => ({ ...prev, objects: prev.objects.map((o) => (o.id === selected ? { ...o, ...patch } : o)) }))
  }

  // 机位 = 当前编辑视角
  function cameraFromView() {
    const r = rt.current
    if (!r) return
    const p = r.editorCam.position
    const tg = r.orbit.target
    setData((prev) => ({ ...prev, camera: { ...prev.camera, position: [p.x, p.y, p.z], target: [tg.x, tg.y, tg.z] } }))
  }

  async function save(): Promise<number | null> {
    setBusy(true)
    setError('')
    try {
      const body = { name: name.trim() || t('studio3d.untitled'), data }
      const saved = sceneId ? await api.updateStudio3dScene(sceneId, body) : await api.createStudio3dScene(body)
      setSceneId(saved.id)
      setName(saved.name)
      await loadList()
      return saved.id
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
      return null
    } finally {
      setBusy(false)
    }
  }

  // 从机位离屏渲染 1280 宽截图并上传
  async function takeSnapshot() {
    const r = rt.current
    if (!r) return
    const id = sceneId ?? (await save())
    if (!id) return
    const aspect = ratioValue(data.ratio)
    const w = aspect >= 1 ? 1280 : Math.round(1280 * aspect)
    const h = Math.round(w / aspect)
    const off = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    off.setSize(w, h)
    off.shadowMap.enabled = true
    r.helpers.forEach((x) => (x.visible = false))
    off.render(r.scene, r.shotCam)
    r.helpers.forEach((x) => (x.visible = true))
    const blob: Blob | null = await new Promise((resolve) => off.domElement.toBlob(resolve, 'image/png'))
    off.dispose()
    if (!blob) return
    setBusy(true)
    try {
      const res = await api.studio3dSnapshot(id, blob)
      setSnapshot(res.url)
      await loadList()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.fail'))
    } finally {
      setBusy(false)
    }
  }

  const current = data.objects.find((o) => o.id === selected)
  const snapshotFull = snapshot ? (snapshot.startsWith('http') ? snapshot : `${API_BASE}${snapshot}`) : ''

  return (
    <AppShell active="tools" wide hideFooter>
      <div className="pf-studio3d">
        <aside className="pf-studio3d-side">
          <h2>{t('studio3d.title')}</h2>
          <p className="pf-muted">{t('studio3d.lead')}</p>
          <button
            type="button"
            className="pf-btn pf-btn-ghost pf-btn-sm"
            onClick={() => {
              setSceneId(null)
              setName('')
              setData(EMPTY_SCENE)
              setSnapshot('')
              setSelected(null)
            }}
          >
            {t('studio3d.newScene')}
          </button>
          <ul className="pf-studio3d-list">
            {scenes.map((s) => (
              <li key={s.id}>
                <button type="button" className={s.id === sceneId ? 'is-active' : ''} onClick={() => void open(s.id)}>
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
          <h3>{t('studio3d.add')}</h3>
          <div className="pf-studio3d-add">
            {OBJECT_TYPES.map((type) => (
              <button key={type} type="button" className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => addObject(type)}>
                {t(`studio3d.objects.${type}`)}
              </button>
            ))}
          </div>
        </aside>

        <div className="pf-studio3d-main">
          <div className="pf-studio3d-bar">
            <input value={name} placeholder={t('studio3d.untitled')} maxLength={128} onChange={(e) => setName(e.target.value)} />
            {(['translate', 'rotate', 'scale'] as const).map((m) => (
              <button key={m} type="button" className={`pf-btn pf-btn-sm ${mode === m ? 'pf-btn-lime' : 'pf-btn-ghost'}`} onClick={() => setMode(m)}>
                {t(`studio3d.mode.${m}`)}
              </button>
            ))}
            <button type="button" className={`pf-btn pf-btn-sm ${shotView ? 'pf-btn-lime' : 'pf-btn-ghost'}`} onClick={() => setShotView((v) => !v)}>
              {shotView ? t('studio3d.editorView') : t('studio3d.shotView')}
            </button>
            <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" disabled={busy} onClick={() => void save()}>
              {t('studio3d.save')}
            </button>
            <button type="button" className="pf-btn pf-btn-lime pf-btn-sm" disabled={busy} onClick={() => void takeSnapshot()}>
              {t('studio3d.snapshot')}
            </button>
          </div>
          {error ? <p className="pf-error">{error}</p> : null}
          <div ref={mountRef} className="pf-studio3d-canvas" />
        </div>

        <aside className="pf-studio3d-side">
          <h3>{t('studio3d.camera')}</h3>
          <label>
            {t('studio3d.lens')}
            <select value={data.camera.lens} onChange={(e) => setData((p) => ({ ...p, camera: { ...p.camera, lens: Number(e.target.value) } }))}>
              {LENSES.map((l) => (
                <option key={l} value={l}>
                  {l}mm
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('studio3d.ratio')}
            <select value={data.ratio} onChange={(e) => setData((p) => ({ ...p, ratio: e.target.value }))}>
              {RATIOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" onClick={cameraFromView}>
            {t('studio3d.cameraFromView')}
          </button>

          {current ? (
            <>
              <h3>{t('studio3d.selected')}</h3>
              <label>
                {t('studio3d.label')}
                <input value={current.label} maxLength={40} onChange={(e) => patchSelected({ label: e.target.value })} />
              </label>
              <label>
                {t('studio3d.color')}
                <input type="color" value={current.color} onChange={(e) => patchSelected({ color: e.target.value })} />
              </label>
              <button
                type="button"
                className="pf-btn pf-btn-ghost pf-btn-sm"
                onClick={() => {
                  setData((p) => ({ ...p, objects: p.objects.filter((o) => o.id !== current.id) }))
                  setSelected(null)
                }}
              >
                {t('studio3d.remove')}
              </button>
            </>
          ) : (
            <p className="pf-muted">{t('studio3d.selectHint')}</p>
          )}

          {snapshotFull ? (
            <>
              <h3>{t('studio3d.lastSnapshot')}</h3>
              <img src={snapshotFull} alt="" className="pf-studio3d-snap" />
              <button type="button" className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => void navigator.clipboard?.writeText(snapshotFull)}>
                {t('library.copy')}
              </button>
              <p className="pf-muted">{t('studio3d.snapshotHint')}</p>
            </>
          ) : null}
        </aside>
      </div>
    </AppShell>
  )
}
