<template>
  <div class="canvas-container">
    <div class="toolbar">
      <input type="color" v-model="brushColor">
      <input type="range" v-model="brushSize" min="1" max="50">
      <button @click="clearCanvas">清空画布</button>
    </div>
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script>
export default {
  data() {
    return {
      brushColor: '#000000',
      brushSize: 5
    }
  },
  mounted() {
    this.initCanvas()
    this.setupDrawing()
  },
  methods: {
    updateBrushSettings() {
      this.ctx.strokeStyle = this.brushColor
      this.ctx.lineWidth = this.brushSize
      this.ctx.lineCap = 'round'
    },
    clearCanvas() {
      this.ctx.clearRect(0, 0, this.$refs.canvas.width, this.$refs.canvas.height)
    },
    initCanvas() {
      const canvas = this.$refs.canvas
      const dpr = window.devicePixelRatio || 1
      canvas.width = canvas.offsetWidth * dpr
      canvas.height = canvas.offsetHeight * dpr
      this.ctx = canvas.getContext('2d')
      this.ctx.scale(dpr, dpr)
      this.updateBrushSettings()
    },
    setupDrawing() {
      const canvas = this.$refs.canvas
      let isDrawing = false
      let lastX = 0
      let lastY = 0

      canvas.addEventListener('mousedown', (e) => {
        isDrawing = true
        ;[lastX, lastY] = [e.offsetX, e.offsetY]
      })

      canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return
        this.updateBrushSettings()
        this.ctx.beginPath()
        this.ctx.moveTo(lastX, lastY)
        this.ctx.lineTo(e.offsetX, e.offsetY)
        this.ctx.stroke()
        ;[lastX, lastY] = [e.offsetX, e.offsetY]
      })

      canvas.addEventListener('mouseup', () => (isDrawing = false))
      canvas.addEventListener('mouseout', () => (isDrawing = false))
    }
  }
    methods: {
      setupDrawing() {
        const ctx = this.$refs.canvas.getContext('2d')
        // 实现鼠标事件监听
      }
    }
  }
}
</script>