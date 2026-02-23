<script setup lang="ts">
import {
  ref,
  onMounted,
  onUnmounted,
  watch,
  computed,
  shallowRef,
} from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { useExplorationStore } from '@/stores/exploration'
import type { AnchorNode } from '@/types'

const props = withDefaults(defineProps<{
  /** When set, only show this node and its descendants */
  rootNodeId?: string | null
}>(), {
  rootNodeId: null,
})

const store = useExplorationStore()
const containerRef = ref<HTMLElement | null>(null)

const nodes = computed(() => {
  const all = store.allNodes
  if (!props.rootNodeId) return all
  // Collect subtree rooted at rootNodeId
  const subtree: AnchorNode[] = []
  const queue = [props.rootNodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = all.find((n) => n.id === id)
    if (node) {
      subtree.push(node)
      queue.push(...node.childIds)
    }
  }
  return subtree
})
const activeId = computed(() => store.activeNodeId)

// Three.js objects kept as shallow refs to avoid deep reactivity overhead
const renderer = shallowRef<THREE.WebGLRenderer | null>(null)
const scene = shallowRef<THREE.Scene | null>(null)
const camera = shallowRef<THREE.PerspectiveCamera | null>(null)
const controls = shallowRef<OrbitControls | null>(null)
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

// Maps node id -> THREE.Mesh for picking / updating
const meshMap = new Map<string, THREE.Mesh>()
const labelMap = new Map<string, THREE.Sprite>()
const edgeLines: THREE.Line[] = []

let animId = 0

// ---- Layout helpers ----

function computeDepth(node: AnchorNode, all: AnchorNode[]): number {
  let depth = 0
  let cur = node
  while (cur.parentId) {
    depth++
    const parent = all.find((n) => n.id === cur.parentId)
    if (!parent) break
    cur = parent
  }
  return depth
}

function computePositions(all: AnchorNode[]): Map<string, THREE.Vector3> {
  const map = new Map<string, THREE.Vector3>()
  if (all.length === 0) return map

  // Group by depth
  const depthGroups = new Map<number, AnchorNode[]>()
  for (const n of all) {
    const d = computeDepth(n, all)
    if (!depthGroups.has(d)) depthGroups.set(d, [])
    depthGroups.get(d)!.push(n)
  }

  const yStep = -3
  for (const [depth, group] of depthGroups) {
    const xSpread = group.length > 1 ? (group.length - 1) * 4 : 0
    for (let i = 0; i < group.length; i++) {
      const x = -xSpread / 2 + i * 4
      const y = depth * yStep
      const z = 0
      map.set(group[i].id, new THREE.Vector3(x, y, z))
    }
  }

  return map
}

// ---- Text sprite helper ----

function makeTextSprite(text: string, isActive: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const fontSize = 36
  ctx.font = `${fontSize}px sans-serif`

  // Truncate long text
  const display = text.length > 30 ? text.slice(0, 27) + '...' : text
  const metrics = ctx.measureText(display)
  const textWidth = metrics.width + 24
  const textHeight = fontSize + 20

  canvas.width = Math.max(256, Math.ceil(textWidth))
  canvas.height = Math.ceil(textHeight) + 10

  // Solid background pill
  const bgColor = isActive ? '#3b1f6e' : '#3f3f46'
  ctx.fillStyle = bgColor
  const r = 10
  const w = canvas.width, h = canvas.height
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(w - r, 0)
  ctx.quadraticCurveTo(w, 0, w, r)
  ctx.lineTo(w, h - r)
  ctx.quadraticCurveTo(w, h, w - r, h)
  ctx.lineTo(r, h)
  ctx.quadraticCurveTo(0, h, 0, h - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.fill()

  ctx.font = `${fontSize}px sans-serif`
  ctx.fillStyle = isActive ? 'rgba(255,255,255,0.95)' : 'rgba(200,200,200,0.90)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(display, canvas.width / 2, canvas.height / 2)

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(canvas.width / 80, canvas.height / 80, 1)
  return sprite
}

// ---- Scene builder ----

function rebuildScene() {
  if (!scene.value) return
  const s = scene.value

  // Clear old
  for (const m of meshMap.values()) s.remove(m)
  for (const l of labelMap.values()) s.remove(l)
  for (const e of edgeLines) s.remove(e)
  meshMap.clear()
  labelMap.clear()
  edgeLines.length = 0

  const all = nodes.value
  if (all.length === 0) return

  const positions = computePositions(all)

  // Create node spheres + labels
  for (const node of all) {
    const pos = positions.get(node.id)
    if (!pos) continue

    const isActive = node.id === activeId.value
    const geo = new THREE.SphereGeometry(0.5, 24, 24)
    const mat = new THREE.MeshStandardMaterial({
      color: isActive ? 0x7c3aed : 0x3f3f46,
      roughness: 0.6,
      metalness: 0.2,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    mesh.userData.nodeId = node.id
    s.add(mesh)
    meshMap.set(node.id, mesh)

    // Label
    const label = makeTextSprite(node.question, isActive)
    label.position.set(pos.x, pos.y + 1, pos.z)
    s.add(label)
    labelMap.set(node.id, label)
  }

  // Create edges
  const lineMat = new THREE.LineBasicMaterial({ color: 0x52525b })
  for (const node of all) {
    if (!node.parentId) continue
    const from = positions.get(node.parentId)
    const to = positions.get(node.id)
    if (!from || !to) continue

    const geo = new THREE.BufferGeometry().setFromPoints([from, to])
    const line = new THREE.Line(geo, lineMat)
    s.add(line)
    edgeLines.push(line)
  }
}

// ---- Click / pick ----

function onClick(e: MouseEvent) {
  if (!containerRef.value || !camera.value || !scene.value) return
  const rect = containerRef.value.getBoundingClientRect()
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(pointer, camera.value)
  const meshes = Array.from(meshMap.values())
  const hits = raycaster.intersectObjects(meshes, false)
  if (hits.length > 0) {
    const nodeId = hits[0].object.userData.nodeId as string
    if (nodeId) store.selectNode(nodeId)
  }
}

// ---- Lifecycle ----

function initScene() {
  if (!containerRef.value) return

  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight

  // Scene
  const s = new THREE.Scene()
  s.background = new THREE.Color(0x27272a)
  scene.value = s

  // Camera
  const cam = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
  cam.position.set(0, 2, 12)
  camera.value = cam

  // Renderer
  const r = new THREE.WebGLRenderer({ antialias: true })
  r.setSize(w, h)
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  containerRef.value.appendChild(r.domElement)
  renderer.value = r

  // Controls (zoom / pan / rotate)
  const ctrl = new OrbitControls(cam, r.domElement)
  ctrl.enableDamping = true
  ctrl.dampingFactor = 0.12
  ctrl.target.set(0, 0, 0)
  controls.value = ctrl

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6)
  s.add(ambient)
  const dir = new THREE.DirectionalLight(0xffffff, 0.8)
  dir.position.set(5, 10, 7)
  s.add(dir)

  // Click handler
  r.domElement.addEventListener('click', onClick)

  rebuildScene()
  animate()
}

function animate() {
  animId = requestAnimationFrame(animate)
  controls.value?.update()
  if (renderer.value && scene.value && camera.value) {
    renderer.value.render(scene.value, camera.value)
  }
}

function handleResize() {
  if (!containerRef.value || !renderer.value || !camera.value) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  renderer.value.setSize(w, h)
  camera.value.aspect = w / h
  camera.value.updateProjectionMatrix()
}

onMounted(() => {
  // Use ResizeObserver so Three.js gets correct dimensions when flex layout finalizes
  const ro = new ResizeObserver(() => {
    if (!renderer.value) {
      initScene()
    } else {
      handleResize()
    }
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

// Rebuild when nodes or active node change
watch([nodes, activeId], () => rebuildScene(), { deep: true })
</script>

<template>
  <div ref="containerRef" class="h-full w-full overflow-hidden">
    <div v-if="nodes.length === 0" class="absolute inset-0 flex items-center justify-center">
      <span class="text-muted-foreground text-xs">No nodes yet</span>
    </div>
  </div>
</template>
