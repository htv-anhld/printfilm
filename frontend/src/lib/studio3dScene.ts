import * as THREE from 'three'

/** 3D 布局：可放置对象类型（与后端 /api/drama/layout3d/options 一致） */
export type ObjectType = 'person' | 'person_sit' | 'box' | 'table' | 'chair' | 'wall' | 'door' | 'car' | 'tree' | 'light'

/** 场景里一个对象的可序列化描述 */
export type SceneObject = {
  id: string
  type: ObjectType
  label: string
  color: string
  position: [number, number, number]
  rotationY: number
  scale: number
}

/** 机位 */
export type ShotCamera = {
  position: [number, number, number]
  target: [number, number, number]
  lens: number
}

export type SceneData = {
  objects: SceneObject[]
  camera: ShotCamera
  ratio: string
}

export const DEFAULT_COLORS: Record<ObjectType, string> = {
  person: '#e58f5b',
  person_sit: '#d9784a',
  box: '#9aa5b1',
  table: '#a0703c',
  chair: '#7d5a36',
  wall: '#d8d4cc',
  door: '#8b6b4a',
  car: '#3b6ea5',
  tree: '#4f8a3c',
  light: '#ffd65c',
}

export const EMPTY_SCENE: SceneData = {
  objects: [],
  camera: { position: [0, 1.6, 6], target: [0, 1, 0], lens: 35 },
  ratio: '16:9',
}

/** 画幅字符串 → 宽高比 */
export function ratioValue(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number)
  return w > 0 && h > 0 ? w / h : 16 / 9
}

/** 35mm 等效焦距 → 垂直视场角（全画幅 24mm 高） */
export function lensToFov(lens: number): number {
  return (2 * Math.atan(24 / (2 * Math.max(lens, 1))) * 180) / Math.PI
}

function mat(color: string, opts: { emissive?: boolean } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, emissive: opts.emissive ? color : '#000', emissiveIntensity: opts.emissive ? 0.6 : 0 })
}

function add(group: THREE.Group, geo: THREE.BufferGeometry, color: string, pos: [number, number, number]) {
  const mesh = new THREE.Mesh(geo, mat(color))
  mesh.position.set(...pos)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/** 用基础几何体拼出对象（人台、桌椅、车、树…），原点在地面 */
export function buildObject(obj: SceneObject): THREE.Group {
  const g = new THREE.Group()
  const c = obj.color
  switch (obj.type) {
    case 'person':
      add(g, new THREE.CapsuleGeometry(0.22, 0.9, 6, 12), c, [0, 0.75, 0])
      add(g, new THREE.SphereGeometry(0.14, 16, 16), c, [0, 1.55, 0])
      add(g, new THREE.BoxGeometry(0.06, 0.06, 0.12), '#222', [0, 1.57, 0.14])
      break
    case 'person_sit':
      add(g, new THREE.CapsuleGeometry(0.22, 0.5, 6, 12), c, [0, 0.85, 0])
      add(g, new THREE.SphereGeometry(0.14, 16, 16), c, [0, 1.45, 0])
      add(g, new THREE.BoxGeometry(0.4, 0.15, 0.5), c, [0, 0.5, 0.25])
      add(g, new THREE.BoxGeometry(0.06, 0.06, 0.12), '#222', [0, 1.47, 0.14])
      break
    case 'box':
      add(g, new THREE.BoxGeometry(0.6, 0.6, 0.6), c, [0, 0.3, 0])
      break
    case 'table':
      add(g, new THREE.BoxGeometry(1.4, 0.06, 0.8), c, [0, 0.75, 0])
      for (const [x, z] of [[-0.62, -0.32], [0.62, -0.32], [-0.62, 0.32], [0.62, 0.32]]) add(g, new THREE.BoxGeometry(0.06, 0.72, 0.06), c, [x, 0.36, z])
      break
    case 'chair':
      add(g, new THREE.BoxGeometry(0.45, 0.05, 0.45), c, [0, 0.45, 0])
      add(g, new THREE.BoxGeometry(0.45, 0.5, 0.05), c, [0, 0.7, -0.2])
      for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(g, new THREE.BoxGeometry(0.04, 0.45, 0.04), c, [x, 0.22, z])
      break
    case 'wall':
      add(g, new THREE.BoxGeometry(4, 2.8, 0.12), c, [0, 1.4, 0])
      break
    case 'door':
      add(g, new THREE.BoxGeometry(0.9, 2.1, 0.06), c, [0, 1.05, 0])
      break
    case 'car':
      add(g, new THREE.BoxGeometry(1.8, 0.6, 4.2), c, [0, 0.55, 0])
      add(g, new THREE.BoxGeometry(1.6, 0.5, 2.2), c, [0, 1.1, -0.2])
      for (const [x, z] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) {
        const w = add(g, new THREE.CylinderGeometry(0.33, 0.33, 0.25, 20), '#222', [x, 0.33, z])
        w.rotation.z = Math.PI / 2
      }
      break
    case 'tree':
      add(g, new THREE.CylinderGeometry(0.12, 0.16, 1.4, 12), '#6b4a2b', [0, 0.7, 0])
      add(g, new THREE.ConeGeometry(0.9, 2, 16), c, [0, 2.2, 0])
      break
    case 'light': {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), mat(c, { emissive: true }))
      bulb.position.set(0, 2.4, 0)
      g.add(bulb)
      const light = new THREE.PointLight(c, 6, 12)
      light.position.set(0, 2.4, 0)
      light.castShadow = true
      g.add(light)
      break
    }
  }
  g.position.set(...obj.position)
  g.rotation.y = obj.rotationY
  g.scale.setScalar(obj.scale)
  g.userData.id = obj.id
  return g
}

/** 根据场景节点回写可序列化数据（拖动 / 旋转后调用） */
export function readTransform(obj: SceneObject, node: THREE.Object3D): SceneObject {
  return {
    ...obj,
    position: [round(node.position.x), round(node.position.y), round(node.position.z)],
    rotationY: round(node.rotation.y),
    scale: round(node.scale.x),
  }
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000
}

/** 新对象：放在原点附近，避免叠在一起 */
export function newObject(type: ObjectType, index: number, label: string): SceneObject {
  const offset = (index % 5) * 0.8 - 1.6
  return {
    id: `${type}-${Date.now().toString(36)}-${index}`,
    type,
    label,
    color: DEFAULT_COLORS[type],
    position: [offset, 0, 0],
    rotationY: 0,
    scale: 1,
  }
}

/** 兼容后端返回的任意 JSON：缺字段补默认值 */
export function normalizeScene(raw: unknown): SceneData {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Partial<SceneData>
  return {
    objects: Array.isArray(data.objects) ? data.objects.filter((o) => o && typeof o === 'object' && 'type' in o) : [],
    camera: { ...EMPTY_SCENE.camera, ...(data.camera || {}) },
    ratio: typeof data.ratio === 'string' ? data.ratio : EMPTY_SCENE.ratio,
  }
}
