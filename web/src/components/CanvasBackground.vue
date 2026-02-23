<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)

const CIRCLE_RADIUS       = 1
const CIRCLE_SPACING      = 5
const RANDOM_OFFSET       = 0
const CIRCLE_STROKE_WIDTH = 2
const CIRCLE_STROKE_OPACITY = 0.22

const BG_FILL     = '#444'
const CIRCLE_FILL = '#bbb'

let resizeObserver: ResizeObserver | null = null

function draw(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const { width: w, height: h } = canvas

  ctx.fillStyle = BG_FILL
  ctx.fillRect(0, 0, w, h)

  for (let y = CIRCLE_SPACING; y < h; y += CIRCLE_SPACING) {
    for (let x = CIRCLE_SPACING; x < w; x += CIRCLE_SPACING) {
      const ox = (Math.random() - 0.5) * RANDOM_OFFSET
      const oy = (Math.random() - 0.5) * RANDOM_OFFSET
      ctx.beginPath()
      ctx.arc(x + ox, y + oy, CIRCLE_RADIUS, 0, Math.PI * 2)
      ctx.fillStyle = CIRCLE_FILL
      ctx.fill()
      ctx.strokeStyle = `rgba(110,110,255,${CIRCLE_STROKE_OPACITY})`
      ctx.lineWidth = CIRCLE_STROKE_WIDTH
      ctx.stroke()
    }
  }
}

onMounted(() => {
  const canvas = canvasRef.value!
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  draw(canvas)

  resizeObserver = new ResizeObserver(() => {
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight
    draw(canvas)
  })
  resizeObserver.observe(document.documentElement)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})
</script>

<template>
  <canvas ref="canvasRef" class="fixed inset-0 z-0 block" />
</template>
