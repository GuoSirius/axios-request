<script setup lang="ts">
import { RouterView } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
</script>

<template>
  <div class="min-h-screen bg-dark bg-gradient-to-br from-dark to-dark-lighter text-light">
    <AppHeader />
    <main class="container mx-auto px-4 py-8 max-w-7xl">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
</style>
