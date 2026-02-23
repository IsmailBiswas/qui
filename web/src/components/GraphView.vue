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
const sqMeshes: THREE.Mesh[] = []   // sub-question rectangles (not pickable)

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

  const depthGroups = new Map<number, AnchorNode[]>()
  for (const n of all) {
    const d = computeDepth(n, all)
    if (!depthGroups.has(d)) depthGroups.set(d, [])
    depthGroups.get(d)!.push(n)
  }

  const yStep = -3.5
  for (const [depth, group] of depthGroups) {
    const xSpread = group.length > 1 ? (group.length - 1) * 4 : 0
    for (let i = 0; i < group.length; i++) {
      const x = -xSpread / 2 + i * 4
      const y = depth * yStep
      map.set(group[i].id, new THREE.Vector3(x, y, 0))
    }
  }

  return map
}

// ---- Anchor label sprite (text only for anchor/root nodes) ----

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
  ctx.fillStyle = isActive ? '#e4e4e7' : '#52525b'
  ctx.fillRect(0, 0, w, h)

  ctx.font = `${fontSize}px sans-serif`
  ctx.fillStyle = isActive ? '#09090b' : '#d4d4d8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(display, w / 2, h / 2)

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

  for (const m of meshMap.values()) s.remove(m)
  for (const l of labelMap.values()) s.remove(l)
  for (const e of edgeLines) s.remove(e)
  for (const m of sqMeshes) s.remove(m)
  meshMap.clear()
  labelMap.clear()
  edgeLines.length = 0
  sqMeshes.length = 0

  const all = nodes.value
  if (all.length === 0) return

  // Position every anchor node as a disk
  const anchorPositions = computePositions(all)

  const lineMat      = new THREE.LineBasicMaterial({ color: 0x71717a })
  const subLineMat   = new THREE.LineBasicMaterial({ color: 0x52525b })

  // ── Anchor disks ──────────────────────────────────────────────────────────
  for (const node of all) {
    const pos     = anchorPositions.get(node.id)
    if (!pos) continue

    const isActive = node.id === activeId.value

    // Flat disk (cylinder with thin height, rotated to face camera)
    const geo = new THREE.CylinderGeometry(0.7, 0.7, 0.12, 48)
    const mat = new THREE.MeshStandardMaterial({
      color:     isActive ? 0xffffff : 0x999999,
      roughness: 0.3,
      metalness: 0.4,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(pos)
    mesh.rotation.x = Math.PI / 2   // face the camera
    mesh.userData.nodeId = node.id
    s.add(mesh)
    meshMap.set(node.id, mesh)

    // Label above the disk — also pickable
    const label = makeAnchorLabel(node.question, isActive)
    label.position.set(pos.x, pos.y + 1.2, pos.z)
    label.userData.nodeId = node.id
    s.add(label)
    labelMap.set(node.id, label)

    // ── Single subdivided rectangle for all sub-questions ──────────────────
    const sqs = node.subQuestions ?? []
    if (sqs.length > 0) {
      const BASE_H    = 0.8      // height of rectangle for 1 sub-question
      const GAP       = 0.08     // gap between cells
      const SQ_W      = 1.2
      const SQ_D      = 0.1
      const SQ_OFFSET = 2.4

      // Max out at double height; N cells divide that space (minus gaps) equally
      const totalH  = sqs.length === 1 ? BASE_H : BASE_H * 2
      const cellH   = (totalH - GAP * (sqs.length - 1)) / sqs.length
      const sqCenter = new THREE.Vector3(pos.x + SQ_OFFSET, pos.y, pos.z)

      // Draw N separate cell boxes with gaps between them
      const sqMat = new THREE.MeshStandardMaterial({
        color:     0x505050,
        roughness: 0.6,
        metalness: 0.1,
      })
      for (let i = 0; i < sqs.length; i++) {
        const cellCentreY = sqCenter.y + totalH / 2 - cellH / 2 - i * (cellH + GAP)
        const cellGeo  = new THREE.BoxGeometry(SQ_W, cellH, SQ_D)
        const cellMesh = new THREE.Mesh(cellGeo, sqMat)
        cellMesh.position.set(sqCenter.x, cellCentreY, sqCenter.z)
        s.add(cellMesh)
        sqMeshes.push(cellMesh)
      }

      // N connectors — one per cell, from disk edge → cell centre-left
      const rectLeft  = sqCenter.x - SQ_W / 2
      const diskRight = pos.x + 0.7
      for (let i = 0; i < sqs.length; i++) {
        const cellCentreY = sqCenter.y + totalH / 2 - cellH / 2 - i * (cellH + GAP)
        const connGeo  = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(diskRight, pos.y, pos.z),
          new THREE.Vector3(rectLeft, cellCentreY, pos.z),
        ])
        const connLine = new THREE.Line(connGeo, subLineMat)
        s.add(connLine)
        edgeLines.push(connLine)
      }
    }
  }

  // ── Anchor-to-anchor edges (tree) ─────────────────────────────────────────
  for (const node of all) {
    if (!node.parentId) continue
    const from = anchorPositions.get(node.parentId)
    const to   = anchorPositions.get(node.id)
    if (!from || !to) continue
    const geo  = new THREE.BufferGeometry().setFromPoints([from, to])
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
  const pickable = [
    ...Array.from(meshMap.values()),
    ...Array.from(labelMap.values()),
  ]
  const hits = raycaster.intersectObjects(pickable, false)
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
  s.background = new THREE.Color(0x18181b)
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
