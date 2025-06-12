<template>
  <div id="app">
    <canvas-component />
  </div>
</template>

<script>
export default {
  components: {
    CanvasComponent: () => import('./components/CanvasComponent.vue')
  }
}
</script>