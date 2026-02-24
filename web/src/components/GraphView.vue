<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, shallowRef } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useExplorationStore } from '@/stores/exploration'
import type { AnchorNode } from '@/types'

const props = withDefaults(defineProps<{
  /** When set, only show this node and its descendants */
  rootNodeId?: string | null
  /** Whether the graph is currently expanded to fill the screen */
  expanded?: boolean
}>(), { rootNodeId: null, expanded: false })

const emit = defineEmits<{
  'toggle-expand': []
  'node-selected': []
}>()

const store = useExplorationStore()
const containerRef = ref<HTMLElement | null>(null)

const nodes = computed(() => {
  const all = store.allNodes
  if (!props.rootNodeId) return all
  const subtree: AnchorNode[] = []
  const queue = [props.rootNodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = all.find(n => n.id === id)
    if (node) { subtree.push(node); queue.push(...node.childIds) }
  }
  return subtree
})
const activeId = computed(() => store.activeNodeId)

// Three.js objects kept as shallow refs to avoid deep reactivity overhead
const renderer  = shallowRef<THREE.WebGLRenderer | null>(null)
const scene     = shallowRef<THREE.Scene | null>(null)
const camera    = shallowRef<THREE.OrthographicCamera | null>(null)
const controls  = shallowRef<OrbitControls | null>(null)
const raycaster = new THREE.Raycaster()
const pointer   = new THREE.Vector2()

const meshMap  = new Map<string, THREE.Mesh>()
const labelMap = new Map<string, THREE.Sprite>()
const edgeLines: THREE.Line[] = []
const sqMeshes: THREE.Mesh[]  = []

let animId = 0

// ---- 2D hierarchical wall layout (XY plane, Z = 0) ----------------------

function computePositions(all: AnchorNode[]): Map<string, THREE.Vector3> {
  const map = new Map<string, THREE.Vector3>()
  if (all.length === 0) return map

  const Y_STEP    = -5   // downward gap between levels
  const X_SPACING = 7    // horizontal spacing between siblings

  const idSet = new Set(all.map(n => n.id))
  const roots = all.filter(n => !n.parentId || !idSet.has(n.parentId))

  roots.forEach((root, i) => {
    const x = (i - (roots.length - 1) / 2) * X_SPACING
    map.set(root.id, new THREE.Vector3(x, 0, 0))
  })

  const queue: AnchorNode[] = [...roots]
  while (queue.length > 0) {
    const parent = queue.shift()!
    const parentPos = map.get(parent.id)
    if (!parentPos) continue
    const children = parent.childIds
      .map(id => all.find(n => n.id === id))
      .filter(Boolean) as AnchorNode[]
    if (children.length === 0) continue
    const totalW = (children.length - 1) * X_SPACING
    children.forEach((child, i) => {
      const x = parentPos.x - totalW / 2 + i * X_SPACING
      map.set(child.id, new THREE.Vector3(x, parentPos.y + Y_STEP, 0))
      queue.push(child)
    })
  }
  return map
}

// ---- Anchor label sprite -------------------------------------------------

function makeAnchorLabel(text: string, isActive: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const fontSize = 32
  const display = text.length > 28 ? text.slice(0, 25) + '...' : text
  ctx.font = `${fontSize}px sans-serif`
  const tw = ctx.measureText(display).width + 24
  canvas.width  = Math.max(256, Math.ceil(tw))
  canvas.height = fontSize + 24
  const w = canvas.width, h = canvas.height
  ctx.fillStyle = isActive ? '#e4e4e7' : '#1c1c1e'
  ctx.fillRect(0, 0, w, h)
  ctx.font = `${fontSize}px sans-serif`
  ctx.fillStyle = isActive ? '#09090b' : '#d4d4d8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(display, w / 2, h / 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: true })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(canvas.width / 80, canvas.height / 80, 1)
  return sprite
}

// ---- Scene builder -------------------------------------------------------

function rebuildScene() {
  if (!scene.value) return
  const s = scene.value

  for (const m of meshMap.values())  s.remove(m)
  for (const l of labelMap.values()) s.remove(l)
  for (const e of edgeLines)         s.remove(e)
  for (const m of sqMeshes)          s.remove(m)
  meshMap.clear(); labelMap.clear()
  edgeLines.length = 0; sqMeshes.length = 0

  const all = nodes.value
  if (all.length === 0) return

  const anchorPositions = computePositions(all)

  const lineMat    = new THREE.LineBasicMaterial({ color: 0xa1a1aa })
  const subLineMat = new THREE.LineBasicMaterial({ color: 0x71717a })

  for (const node of all) {
    const pos = anchorPositions.get(node.id)
    if (!pos) continue
    const isActive = node.id === activeId.value

    // -- Sphere (radius 0.4, sits flush against the wall at z = 0) ---------
    const sphereGeo = new THREE.SphereGeometry(0.4, 48, 32)
    const sphereMat = new THREE.MeshStandardMaterial({
      color:             isActive ? 0xffffff : 0xd4d8d4,
      emissive:          isActive ? 0x008888 : 0x334466,
      emissiveIntensity: isActive ? 0.55 : 0.25,
      roughness: 0.2,
      metalness: 0.55,
    })
    const mesh = new THREE.Mesh(sphereGeo, sphereMat)
    mesh.position.copy(pos)
    mesh.userData.nodeId = node.id
    s.add(mesh)
    meshMap.set(node.id, mesh)

    // -- Label above sphere ------------------------------------------------
    const label = makeAnchorLabel(node.question, isActive)
    label.position.set(pos.x, pos.y + 1.05, 0.1)
    label.userData.nodeId = node.id
    s.add(label)
    labelMap.set(node.id, label)

    // -- Sub-question rectangles to the right of the sphere ----------------
    const sqs = node.subQuestions ?? []
    if (sqs.length > 0) {
      const BASE_H    = 0.8
      const GAP       = 0.08
      const SQ_W      = 1.2
      const SQ_D      = 0.08   // thin box, nearly flush with wall
      const SQ_OFFSET = 2.4

      const totalH   = sqs.length === 1 ? BASE_H : BASE_H * 2
      const cellH    = (totalH - GAP * (sqs.length - 1)) / sqs.length
      const sqCenter = new THREE.Vector3(pos.x + SQ_OFFSET, pos.y, 0)

      const sqMat = new THREE.MeshStandardMaterial({
        color:    0x7c7c8a,
        emissive: 0x1a1a2e,
        roughness: 0.4,
        metalness: 0.3,
      })

      for (let i = 0; i < sqs.length; i++) {
        const cy = sqCenter.y + totalH / 2 - cellH / 2 - i * (cellH + GAP)

        const cellMesh = new THREE.Mesh(
          new THREE.BoxGeometry(SQ_W, cellH, SQ_D),
          sqMat,
        )
        cellMesh.position.set(sqCenter.x, cy, 0)
        s.add(cellMesh)
        sqMeshes.push(cellMesh)
      }

      // Connectors from sphere edge to each rect cell
      const rectLeft  = sqCenter.x - SQ_W / 2
      const diskRight = pos.x + 0.42
      for (let i = 0; i < sqs.length; i++) {
        const cy = sqCenter.y + totalH / 2 - cellH / 2 - i * (cellH + GAP)
        const connGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(diskRight, pos.y, 0),
          new THREE.Vector3(rectLeft,  cy,     0),
        ])
        const connLine = new THREE.Line(connGeo, subLineMat)
        s.add(connLine)
        edgeLines.push(connLine)
      }
    }
  }

  // ── Anchor-to-anchor edges ───────────────────────────────────────────────
  for (const node of all) {
    if (!node.parentId) continue
    const from = anchorPositions.get(node.parentId)
    const to   = anchorPositions.get(node.id)
    if (!from || !to) continue
    const geo  = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, 0),
      new THREE.Vector3(to.x,   to.y,   0),
    ])
    const line = new THREE.Line(geo, lineMat)
    s.add(line)
    edgeLines.push(line)
  }

  // Fit all nodes into view after every rebuild
  fitCamera()
}

// ---- Click / pick --------------------------------------------------------

function fitCamera() {
  if (!camera.value || !controls.value || !containerRef.value) return
  if (meshMap.size === 0) return

  // Build tight bounding box from ALL visible geometry (spheres, labels, sub-question boxes)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

  function expandBounds(x: number, y: number, hw: number, hh: number) {
    minX = Math.min(minX, x - hw)
    maxX = Math.max(maxX, x + hw)
    minY = Math.min(minY, y - hh)
    maxY = Math.max(maxY, y + hh)
  }

  // Spheres (radius 0.4) + labels above (roughly 1.0 above center, ~0.35 tall)
  for (const m of meshMap.values()) {
    const p = m.position
    expandBounds(p.x, p.y, 0.5, 0.5)          // sphere with margin
    expandBounds(p.x, p.y + 1.05, 1.6, 0.35)  // label sprite
  }

  // Sub-question boxes
  for (const m of sqMeshes) {
    const p = m.position
    const g = m.geometry as THREE.BoxGeometry
    const params = g.parameters
    expandBounds(p.x, p.y, params.width / 2 + 0.1, params.height / 2 + 0.1)
  }

  const contentW = maxX - minX || 1
  const contentH = maxY - minY || 1
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  const aspect = w / h

  const PADDING = 1.35  // 35% margin around content
  const zoomX = (FRUSTUM_H * aspect) / (contentW * PADDING)
  const zoomY = FRUSTUM_H / (contentH * PADDING)
  camera.value.zoom = Math.max(0.05, Math.min(zoomX, zoomY))
  camera.value.updateProjectionMatrix()

  // Move both target and camera so the content is truly centred
  controls.value.target.set(cx, cy, 0)
  camera.value.position.set(cx, cy, 10)
  controls.value.update()
}

function onClick(e: MouseEvent) {
  if (!containerRef.value || !camera.value || !scene.value) return
  const rect = containerRef.value.getBoundingClientRect()
  pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
  pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera.value)
  const pickable = [...meshMap.values(), ...labelMap.values()]
  const hits = raycaster.intersectObjects(pickable, false)
  const hit = hits[0]
  if (hit) {
    const nodeId = hit.object.userData.nodeId as string | undefined
    if (nodeId) {
      store.selectNode(nodeId)
      emit('node-selected')
    }
  }
}

// ---- Camera helpers (Orthographic) ---------------------------------------

const FRUSTUM_H = 20   // world-units visible in height at zoom = 1

function frustumFromSize(w: number, h: number) {
  const fw = FRUSTUM_H * (w / h)
  const fh = FRUSTUM_H
  return { left: -fw / 2, right: fw / 2, top: fh / 2, bottom: -fh / 2 }
}

// ---- Lifecycle -----------------------------------------------------------

function initScene() {
  if (!containerRef.value) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight

  // Scene — deep-black void behind the wall
  const s = new THREE.Scene()
  s.background = new THREE.Color(0x060608)
  scene.value = s

  // Large gray back-wall plane; AO shadows are composited in front of it
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.MeshStandardMaterial({
      color:    0x272729,
      roughness: 0.85,
      metalness: 0.05,
    }),
  )
  wall.position.z = -0.5
  s.add(wall)

  // Orthographic camera looking straight down -Z
  const { left, right, top, bottom } = frustumFromSize(w, h)
  const cam = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 200)
  cam.position.set(0, 0, 10)
  cam.lookAt(0, 0, 0)
  camera.value = cam

  // Renderer
  const r = new THREE.WebGLRenderer({ antialias: true })
  r.setSize(w, h)
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  containerRef.value.appendChild(r.domElement)
  renderer.value = r

  // OrbitControls — pan + zoom only, NO rotation
  const ctrl = new OrbitControls(cam, r.domElement)
  ctrl.enableRotate       = false
  ctrl.enableDamping      = true
  ctrl.dampingFactor      = 0.12
  ctrl.screenSpacePanning = true   // pan stays in the XY plane
  // Left-click drag and right-click drag both pan; scroll wheel zooms
  ctrl.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
  // One-finger touch pans; two-finger pinch/pan does dolly + pan
  ctrl.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN }
  ctrl.target.set(0, 0, 0)
  controls.value = ctrl

  // Lighting: ambient + two directional lights from positive-Z side so the
  // spheres get subtle shading even though they face the camera flatly.
  s.add(new THREE.AmbientLight(0xffffff, 2.2))
  const dir1 = new THREE.DirectionalLight(0xffffff, 1.8)
  dir1.position.set(3, 6, 10)
  s.add(dir1)
  const dir2 = new THREE.DirectionalLight(0xb0c8ff, 0.6)
  dir2.position.set(-4, -3, 8)
  s.add(dir2)

  r.domElement.addEventListener('click', onClick)
  rebuildScene()
  animate()
}

function animate() {
  animId = requestAnimationFrame(animate)
  controls.value?.update()
  // Sync renderer size every frame so it stays correct during CSS grow/shrink animations
  if (containerRef.value && renderer.value && camera.value) {
    const w = containerRef.value.clientWidth
    const h = containerRef.value.clientHeight
    const size = renderer.value.getSize(new THREE.Vector2())
    if (size.x !== w || size.y !== h) {
      renderer.value.setSize(w, h)
      const cam = camera.value
      const { left, right, top, bottom } = frustumFromSize(w, h)
      cam.left = left; cam.right = right; cam.top = top; cam.bottom = bottom
      cam.updateProjectionMatrix()
    }
  }
  if (renderer.value && scene.value && camera.value) {
    renderer.value.render(scene.value, camera.value)
  }
}

function handleResize() {
  if (!containerRef.value || !renderer.value || !camera.value) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  renderer.value.setSize(w, h)
  const cam = camera.value
  const { left, right, top, bottom } = frustumFromSize(w, h)
  cam.left = left; cam.right = right; cam.top = top; cam.bottom = bottom
  cam.updateProjectionMatrix()
}

onMounted(() => {
  const ro = new ResizeObserver(() => {
    if (!renderer.value) initScene()
    else handleResize()
  })
  if (containerRef.value) ro.observe(containerRef.value)
  window.addEventListener('resize', handleResize)
  onUnmounted(() => ro.disconnect())
})

onUnmounted(() => {
  cancelAnimationFrame(animId)
  renderer.value?.domElement.removeEventListener('click', onClick)
  renderer.value?.dispose()
  window.removeEventListener('resize', handleResize)
})

// Only rebuild on structural changes — not on streaming answer text
const structureKey = computed(() =>
  JSON.stringify([
    activeId.value,
    nodes.value.map(n => [n.id, n.subQuestions.map(sq => sq.id)]),
  ])
)
watch(structureKey, () => rebuildScene())
</script>

<template>
  <div ref="containerRef" class="relative h-full w-full overflow-hidden">
    <div v-if="nodes.length === 0" class="absolute inset-0 flex items-center justify-center">
      <span class="text-muted-foreground text-xs">No nodes yet</span>
    </div>
    <button
      class="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded border border-white/10 bg-black/40 text-white/60 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white"
      :title="props.expanded ? 'Collapse view' : 'Expand view'"
      @click.stop="emit('toggle-expand')"
    >
      <!-- Expand icon -->
      <svg v-if="!props.expanded" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 3 21 3 21 9" />
        <polyline points="9 21 3 21 3 15" />
        <line x1="21" y1="3" x2="14" y2="10" />
        <line x1="3" y1="21" x2="10" y2="14" />
      </svg>
      <!-- Compress icon -->
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 14 10 14 10 20" />
        <polyline points="20 10 14 10 14 4" />
        <line x1="10" y1="14" x2="3" y2="21" />
        <line x1="21" y1="3" x2="14" y2="10" />
      </svg>
    </button>
  </div>
</template>
